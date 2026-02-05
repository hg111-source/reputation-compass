import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APIFY_BASE_URL = 'https://api.apify.com/v2';
const TRIPADVISOR_ACTOR_ID = 'maxcopell~tripadvisor';

interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
}

interface TripAdvisorResult {
  name?: string;
  rating?: number;
  reviewsCount?: number;
  numberOfReviews?: number;
  url?: string;
}

async function waitForRun(runId: string, token: string, maxWaitMs = 120000): Promise<string> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`${APIFY_BASE_URL}/actor-runs/${runId}?token=${token}`);
    const data = await response.json();
    
    if (data.data.status === 'SUCCEEDED') {
      return data.data.defaultDatasetId;
    }
    
    if (data.data.status === 'FAILED' || data.data.status === 'ABORTED') {
      throw new Error(`Apify run ${data.data.status}`);
    }
    
    // Wait 3 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 3000));
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

    const { hotelName, city } = await req.json();
    
    if (!hotelName || !city) {
      return new Response(
        JSON.stringify({ error: 'hotelName and city are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchQuery = `${hotelName} ${city}`;
    console.log(`TripAdvisor search: ${searchQuery}`);

    // Start the Apify actor run
    const runResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${TRIPADVISOR_ACTOR_ID}/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchQuery: searchQuery,
          maxItems: 1,
          language: 'en',
          currency: 'USD',
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

    // Wait for the run to complete
    const datasetId = await waitForRun(runId, apiToken);
    
    // Get the results
    const resultsResponse = await fetch(
      `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
    );
    
    if (!resultsResponse.ok) {
      throw new Error('Failed to fetch Apify results');
    }

    const results: TripAdvisorResult[] = await resultsResponse.json();
    
    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          message: 'No matching hotel found on TripAdvisor' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hotel = results[0];
    const reviewCount = hotel.reviewsCount || hotel.numberOfReviews || 0;

    return new Response(
      JSON.stringify({
        found: true,
        name: hotel.name,
        rating: hotel.rating ?? null,
        reviewCount: reviewCount,
        scale: 5, // TripAdvisor uses 0-5 scale
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error fetching TripAdvisor rating:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
