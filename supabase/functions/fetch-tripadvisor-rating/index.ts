import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APIFY_BASE_URL = 'https://api.apify.com/v2';
const TRIPADVISOR_ACTOR_ID = 'dbEyMBriog95Fv8CW'; // maxcopell/tripadvisor

interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
}

interface TripAdvisorReview {
  text?: string;
  rating?: number;
  publishedDate?: string;
  user?: {
    username?: string;
  };
}

interface TripAdvisorResult {
  name?: string;
  rating?: number;
  reviewsCount?: number;
  numberOfReviews?: number;
  reviewCount?: number;
  url?: string;
  reviews?: TripAdvisorReview[];
}

async function waitForRun(runId: string, token: string, maxWaitMs = 120000): Promise<string> {
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

// Try direct URL scraping
async function tryDirectUrl(startUrl: string, apiToken: string, includeReviews: boolean, maxReviews: number): Promise<TripAdvisorResult | null> {
  console.log(`TripAdvisor trying direct URL: "${startUrl}"`);
  
  try {
    const runResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${TRIPADVISOR_ACTOR_ID}/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: startUrl }],
          maxItems: 1,
          language: 'en',
          includeReviews: includeReviews,
          maxReviews: includeReviews ? maxReviews : 0,
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
    
    console.log(`Apify TripAdvisor direct URL run started: ${runId}`);

    const datasetId = await waitForRun(runId, apiToken);
    
    const resultsResponse = await fetch(
      `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
    );
    
    if (!resultsResponse.ok) {
      return null;
    }

    const results: TripAdvisorResult[] = await resultsResponse.json();
    return results && results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error(`Direct URL fetch failed:`, error);
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
    
    // Debug: log token format (masked)
    console.log(`Token starts with: ${apiToken.substring(0, 10)}..., length: ${apiToken.length}`);

    const { hotelName, city, startUrl, includeReviews = false, maxReviews = 50 } = await req.json();
    
    if (!hotelName || !city) {
      return new Response(
        JSON.stringify({ error: 'hotelName and city are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let hotel: TripAdvisorResult | null = null;

    // If we have a direct URL, try that first
    if (startUrl) {
      console.log(`Using pre-resolved URL for TripAdvisor: ${startUrl}`);
      hotel = await tryDirectUrl(startUrl, apiToken, includeReviews, maxReviews);
    }

    // Fall back to search if no URL or URL fetch failed
    if (!hotel) {
      const searchQuery = `${hotelName} ${city}`;
      console.log(`TripAdvisor search: ${searchQuery}, includeReviews: ${includeReviews}`);

      // Start the Apify actor run with correct input format
      const runResponse = await fetch(
        `${APIFY_BASE_URL}/acts/${TRIPADVISOR_ACTOR_ID}/runs?token=${apiToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: searchQuery,
            maxItems: 1,
            language: 'en',
            includeReviews: includeReviews,
            maxReviews: includeReviews ? maxReviews : 0,
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
      
      console.log(`Apify TripAdvisor run started: ${runId}`);

      // Wait for the run to complete (polls every 5 seconds, timeout 120 seconds)
      const datasetId = await waitForRun(runId, apiToken);
      
      // Get the results
      const resultsResponse = await fetch(
        `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
      );
      
      if (!resultsResponse.ok) {
        throw new Error('Failed to fetch Apify results');
      }

      const results: TripAdvisorResult[] = await resultsResponse.json();
      
      console.log(`TripAdvisor results:`, JSON.stringify(results[0] || {}, null, 2));
      
      hotel = results && results.length > 0 ? results[0] : null;
    }
    
    if (!hotel) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          message: 'No matching hotel found on TripAdvisor' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TripAdvisor uses 0-5 scale
    const rating = hotel.rating ?? null;
    const reviewCount = hotel.reviewsCount || hotel.numberOfReviews || hotel.reviewCount || 0;

    // Process reviews if requested and available
    const reviews = includeReviews && hotel.reviews 
      ? hotel.reviews.map((r: TripAdvisorReview) => ({
          text: r.text || '',
          rating: r.rating,
          date: r.publishedDate,
          reviewer: r.user?.username,
        })).filter((r: { text: string }) => r.text.length > 0)
      : [];

    return new Response(
      JSON.stringify({
        found: true,
        name: hotel.name,
        rating: rating,
        reviewCount: reviewCount,
        scale: 5, // TripAdvisor uses 0-5 scale
        reviews: reviews,
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
