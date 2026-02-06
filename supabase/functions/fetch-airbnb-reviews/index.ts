import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AirbnbReview {
  text: string;
  rating?: number;
  reviewerName?: string;
  date?: string;
}

interface ApifyResponse {
  reviews?: Array<{
    comments?: string;
    rating?: number;
    reviewer?: { firstName?: string };
    createdAt?: string;
  }>;
  name?: string;
  rating?: number;
  reviewsCount?: number;
  location?: {
    city?: string;
    state?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roomId, url, maxReviews = 25 } = await req.json();

    if (!roomId && !url) {
      return new Response(
        JSON.stringify({ success: false, error: 'roomId or url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    if (!APIFY_API_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: 'APIFY_API_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build Airbnb URL
    const airbnbUrl = url || `https://www.airbnb.com/rooms/${roomId}`;
    console.log('Fetching Airbnb reviews for:', airbnbUrl);

    // Use Apify Airbnb scraper
    const apifyUrl = 'https://api.apify.com/v2/acts/tri_angle~airbnb-scraper/run-sync-get-dataset-items';
    
    const apifyResponse = await fetch(`${apifyUrl}?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: airbnbUrl }],
        maxReviews: maxReviews,
        includeReviews: true,
        proxyConfiguration: { useApifyProxy: true },
      }),
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      console.error('Apify error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Apify request failed: ${apifyResponse.status}` }),
        { status: apifyResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: ApifyResponse[] = await apifyResponse.json();
    const listing = results[0];

    if (!listing) {
      return new Response(
        JSON.stringify({ success: false, error: 'No listing data returned' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract reviews
    const reviews: AirbnbReview[] = (listing.reviews || []).map(r => ({
      text: r.comments || '',
      rating: r.rating,
      reviewerName: r.reviewer?.firstName,
      date: r.createdAt,
    })).filter(r => r.text.length > 0);

    // Calculate average rating from reviews if not provided
    let avgRating = listing.rating;
    if (!avgRating && reviews.length > 0) {
      const ratingsWithValues = reviews.filter(r => r.rating !== undefined);
      if (ratingsWithValues.length > 0) {
        avgRating = ratingsWithValues.reduce((sum, r) => sum + (r.rating || 0), 0) / ratingsWithValues.length;
      }
    }

    console.log(`Found ${reviews.length} reviews, avg rating: ${avgRating}`);

    return new Response(
      JSON.stringify({
        success: true,
        name: listing.name,
        rating: avgRating,
        reviewsCount: listing.reviewsCount || reviews.length,
        city: listing.location?.city,
        state: listing.location?.state,
        reviews,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching Airbnb reviews:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
