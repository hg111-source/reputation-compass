import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APIFY_BASE_URL = 'https://api.apify.com/v2';

// Apify actor IDs
const ACTORS = {
  tripadvisor: 'dbEyMBriog95Fv8CW', // maxcopell/tripadvisor
  google: 'nwua9Gu5YrADL7ZDj', // compass/crawler-google-places
};

interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
}

async function waitForRun(runId: string, token: string, maxWaitMs = 180000): Promise<string> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`${APIFY_BASE_URL}/actor-runs/${runId}?token=${token}`);
    const data = await response.json();
    
    console.log(`Run ${runId} status: ${data.data.status}`);
    
    if (data.data.status === 'SUCCEEDED') {
      return data.data.defaultDatasetId;
    }
    
    if (data.data.status === 'FAILED' || data.data.status === 'ABORTED' || data.data.status === 'TIMED-OUT') {
      throw new Error(`Apify run ${data.data.status}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error('Apify run timeout');
}

async function fetchTripAdvisorReviews(
  apiToken: string,
  searchQuery: string,
  maxReviews: number
): Promise<{ reviews: any[]; hotelName: string }> {
  const runResponse = await fetch(
    `${APIFY_BASE_URL}/acts/${ACTORS.tripadvisor}/runs?token=${apiToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: searchQuery,
        maxItems: 1,
        language: 'en',
        includeReviews: true,
        maxReviews: maxReviews,
      }),
    }
  );

  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    console.error('TripAdvisor run start error:', errorText);
    throw new Error(`Failed to start TripAdvisor run: ${runResponse.status}`);
  }

  const runData: ApifyRunResponse = await runResponse.json();
  console.log(`TripAdvisor Apify run started: ${runData.data.id}`);

  const datasetId = await waitForRun(runData.data.id, apiToken);
  
  const resultsResponse = await fetch(
    `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
  );
  
  if (!resultsResponse.ok) {
    throw new Error('Failed to fetch TripAdvisor results');
  }

  const results = await resultsResponse.json();
  
  if (!results || results.length === 0) {
    return { reviews: [], hotelName: '' };
  }

  const hotel = results[0];
  return {
    reviews: (hotel.reviews || []).map((r: any) => ({
      text: r.text || '',
      rating: r.rating,
      date: r.publishedDate,
      reviewer: r.user?.username,
    })),
    hotelName: hotel.name || '',
  };
}

async function fetchGoogleReviews(
  apiToken: string,
  searchQuery: string,
  maxReviews: number
): Promise<{ reviews: any[]; hotelName: string }> {
  const runResponse = await fetch(
    `${APIFY_BASE_URL}/acts/${ACTORS.google}/runs?token=${apiToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray: [searchQuery],
        maxCrawledPlacesPerSearch: 1,
        language: 'en',
        maxReviews: maxReviews,
        scrapeReviewsPersonalData: false,
      }),
    }
  );

  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    console.error('Google run start error:', errorText);
    throw new Error(`Failed to start Google run: ${runResponse.status}`);
  }

  const runData: ApifyRunResponse = await runResponse.json();
  console.log(`Google Apify run started: ${runData.data.id}`);

  const datasetId = await waitForRun(runData.data.id, apiToken);
  
  const resultsResponse = await fetch(
    `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
  );
  
  if (!resultsResponse.ok) {
    throw new Error('Failed to fetch Google results');
  }

  const results = await resultsResponse.json();
  
  if (!results || results.length === 0) {
    return { reviews: [], hotelName: '' };
  }

  const place = results[0];
  return {
    reviews: (place.reviews || []).map((r: any) => ({
      text: r.text || r.textTranslated || '',
      rating: r.stars,
      date: r.publishedAtDate,
      reviewer: r.name,
    })),
    hotelName: place.title || '',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apiToken) {
      throw new Error('APIFY_API_TOKEN is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      propertyId, 
      hotelName, 
      city, 
      platform = 'all', 
      maxReviews = 50 
    } = await req.json();
    
    if (!propertyId || !hotelName || !city) {
      return new Response(
        JSON.stringify({ error: 'propertyId, hotelName, and city are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchQuery = `${hotelName} ${city} hotel`;
    console.log(`Fetching ${platform} reviews for: ${searchQuery}`);

    const platformsToFetch = platform === 'all' 
      ? ['tripadvisor', 'google'] 
      : [platform];

    const results: { platform: string; reviews: any[]; hotelName: string }[] = [];

    // Fetch from each platform
    for (const p of platformsToFetch) {
      try {
        console.log(`Fetching from ${p}...`);
        
        if (p === 'tripadvisor') {
          const tripResult = await fetchTripAdvisorReviews(apiToken, searchQuery, maxReviews);
          results.push({ platform: 'tripadvisor', ...tripResult });
        } else if (p === 'google') {
          const googleResult = await fetchGoogleReviews(apiToken, searchQuery, maxReviews);
          results.push({ platform: 'google', ...googleResult });
        }
      } catch (err) {
        console.error(`Error fetching from ${p}:`, err);
        // Continue with other platforms
      }
    }

    let totalReviews = 0;

    // Store reviews for each platform
    for (const result of results) {
      if (result.reviews.length === 0) continue;

      // Delete existing reviews for this property/platform
      await supabase
        .from('review_texts')
        .delete()
        .eq('property_id', propertyId)
        .eq('platform', result.platform);

      const reviewsToInsert = result.reviews
        .filter((r: { text?: string }) => r.text && r.text.length > 10)
        .map((r: { text?: string; rating?: number; date?: string; reviewer?: string }) => ({
          property_id: propertyId,
          platform: result.platform,
          review_text: r.text || '',
          review_rating: r.rating || null,
          review_date: r.date || null,
          reviewer_name: r.reviewer || null,
        }));

      if (reviewsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('review_texts')
          .insert(reviewsToInsert);

        if (insertError) {
          console.error(`Failed to insert ${result.platform} reviews:`, insertError);
        } else {
          totalReviews += reviewsToInsert.length;
          console.log(`Inserted ${reviewsToInsert.length} ${result.platform} reviews`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reviewCount: totalReviews,
        platforms: results.map(r => ({ platform: r.platform, count: r.reviews.length })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error fetching reviews:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});