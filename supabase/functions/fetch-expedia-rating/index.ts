import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APIFY_BASE_URL = 'https://api.apify.com/v2';
const EXPEDIA_ACTOR_ID = '4zyibEJ79jE7VXIpA'; // tri_angle/expedia-hotels-com-reviews-scraper

interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
}

interface ExpediaResult {
  hotelName?: string;
  hotelOverallRating?: number;
  hotelReviewCount?: number;
  url?: string;
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
    
    // Poll every 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error('Apify run timeout - try again later');
}

async function fetchExpediaRating(startUrl: string, apiToken: string): Promise<ExpediaResult | null> {
  console.log(`Fetching Expedia rating from: "${startUrl}"`);
  
  try {
    // Use tri_angle actor with startUrls input
    const runResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${EXPEDIA_ACTOR_ID}/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: startUrl }],
        }),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Apify run start error:', errorText);
      return null;
    }

    const runData: ApifyRunResponse = await runResponse.json();
    const runId = runData.data.id;
    
    console.log(`Apify Expedia run started: ${runId}`);

    const datasetId = await waitForRun(runId, apiToken);
    
    const resultsResponse = await fetch(
      `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
    );
    
    if (!resultsResponse.ok) {
      return null;
    }

    const results: ExpediaResult[] = await resultsResponse.json();
    console.log(`Expedia results:`, JSON.stringify(results, null, 2));
    
    return results && results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error(`Expedia fetch failed:`, error);
    return null;
  }
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

    const { hotelName, city, startUrl } = await req.json();
    
    if (!hotelName || !city) {
      return new Response(
        JSON.stringify({ error: 'hotelName and city are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // This actor requires a direct URL - no search capability
    if (!startUrl) {
      console.log(`No Expedia URL provided for ${hotelName}, cannot fetch rating`);
      return new Response(
        JSON.stringify({ 
          found: false,
          notListed: true,
          message: 'No Expedia URL configured - use Resolve URLs first' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Using pre-resolved URL for Expedia: ${startUrl}`);
    const result = await fetchExpediaRating(startUrl, apiToken);

    if (!result) {
      console.log(`No results found for ${hotelName}`);
      return new Response(
        JSON.stringify({ 
          found: false,
          notListed: true,
          message: 'Hotel not found on Expedia' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Expedia final result:`, JSON.stringify(result, null, 2));

    // tri_angle actor uses hotelOverallRating (0-10 scale)
    const rawRating = result.hotelOverallRating || null;
    const reviewCount = result.hotelReviewCount || 0;

    if (rawRating === null) {
      return new Response(
        JSON.stringify({ 
          found: false,
          notListed: true,
          message: 'No rating data returned' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        found: true,
        name: result.hotelName,
        rating: rawRating,
        reviewCount: reviewCount,
        scale: 10, // tri_angle returns 0-10 scale
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error fetching Expedia rating:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
