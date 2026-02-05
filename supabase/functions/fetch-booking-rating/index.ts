import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APIFY_BASE_URL = 'https://api.apify.com/v2';
const BOOKING_ACTOR_ID = 'oeiQgfg5fsmIJB7Cn'; // voyager/booking-scraper

interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
}

interface BookingResult {
  name?: string;
  rating?: number;
  reviewScore?: number;
  score?: number;
  reviewCount?: number;
  numberOfReviews?: number;
  reviews?: number;
  url?: string;
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
    console.log(`Booking.com search: ${searchQuery}`);

    // Start the Apify actor run with correct input format
    const runResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${BOOKING_ACTOR_ID}/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search: searchQuery,
          maxItems: 1,
          simple: true,
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
    
    console.log(`Apify Booking.com run started: ${runId}`);

    // Wait for the run to complete (polls every 5 seconds, timeout 120 seconds)
    const datasetId = await waitForRun(runId, apiToken);
    
    // Get the results
    const resultsResponse = await fetch(
      `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
    );
    
    if (!resultsResponse.ok) {
      throw new Error('Failed to fetch Apify results');
    }

    const results: BookingResult[] = await resultsResponse.json();
    
    console.log(`Booking.com results:`, JSON.stringify(results[0] || {}, null, 2));
    
    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          message: 'No matching hotel found on Booking.com' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hotel = results[0];
    // Booking.com typically uses 0-10 scale
    const rating = hotel.reviewScore || hotel.score || hotel.rating || null;
    const reviewCount = hotel.reviewCount || hotel.numberOfReviews || hotel.reviews || 0;

    return new Response(
      JSON.stringify({
        found: true,
        name: hotel.name,
        rating: rating,
        reviewCount: reviewCount,
        scale: 10, // Booking.com uses 0-10 scale
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error fetching Booking.com rating:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
