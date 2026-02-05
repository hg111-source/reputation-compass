import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APIFY_BASE_URL = 'https://api.apify.com/v2';
const TRIPADVISOR_ACTOR_ID = 'dbEyMBriog95Fv8CW';

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

    const { propertyId, hotelName, city, platform = 'tripadvisor', maxReviews = 50 } = await req.json();
    
    if (!propertyId || !hotelName || !city) {
      return new Response(
        JSON.stringify({ error: 'propertyId, hotelName, and city are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching ${platform} reviews for: ${hotelName}, ${city}`);

    if (platform !== 'tripadvisor') {
      return new Response(
        JSON.stringify({ error: 'Currently only TripAdvisor reviews are supported' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchQuery = `${hotelName} ${city}`;

    // Start Apify run with reviews enabled
    const runResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${TRIPADVISOR_ACTOR_ID}/runs?token=${apiToken}`,
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
      console.error('Apify run start error:', errorText);
      throw new Error(`Failed to start Apify run: ${runResponse.status}`);
    }

    const runData: ApifyRunResponse = await runResponse.json();
    const runId = runData.data.id;
    
    console.log(`Apify run started: ${runId}`);

    const datasetId = await waitForRun(runId, apiToken);
    
    const resultsResponse = await fetch(
      `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
    );
    
    if (!resultsResponse.ok) {
      throw new Error('Failed to fetch Apify results');
    }

    const results = await resultsResponse.json();
    
    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ found: false, message: 'No hotel found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hotel = results[0];
    const reviews = hotel.reviews || [];

    console.log(`Found ${reviews.length} reviews`);

    // Delete existing reviews for this property/platform
    await supabase
      .from('review_texts')
      .delete()
      .eq('property_id', propertyId)
      .eq('platform', platform);

    // Insert new reviews
    if (reviews.length > 0) {
      const reviewsToInsert = reviews
        .filter((r: { text?: string }) => r.text && r.text.length > 0)
        .map((r: { text?: string; rating?: number; publishedDate?: string; user?: { username?: string } }) => ({
          property_id: propertyId,
          platform: platform,
          review_text: r.text || '',
          review_rating: r.rating || null,
          review_date: r.publishedDate || null,
          reviewer_name: r.user?.username || null,
        }));

      if (reviewsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('review_texts')
          .insert(reviewsToInsert);

        if (insertError) {
          console.error('Failed to insert reviews:', insertError);
          throw new Error(`Failed to store reviews: ${insertError.message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reviewCount: reviews.length,
        hotelName: hotel.name,
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
