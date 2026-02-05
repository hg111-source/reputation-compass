import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { propertyId } = await req.json();
    
    if (!propertyId) {
      return new Response(
        JSON.stringify({ error: 'propertyId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Check hotel_aliases for resolved Expedia URL
    const { data: alias, error: aliasError } = await supabase
      .from('hotel_aliases')
      .select('platform_url, resolution_status')
      .eq('property_id', propertyId)
      .eq('source', 'expedia')
      .single();

    if (aliasError && aliasError.code !== 'PGRST116') {
      console.error('Error fetching alias:', aliasError);
      throw new Error('Database error');
    }

    // Step 2: If no alias or no URL, return no_alias status
    if (!alias || !alias.platform_url) {
      console.log(`No Expedia URL found for property ${propertyId}`);
      return new Response(
        JSON.stringify({ 
          success: false,
          status: 'no_alias',
          message: 'Resolve URLs first to get Expedia rating' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if marked as not_listed
    if (alias.resolution_status === 'not_listed') {
      return new Response(
        JSON.stringify({ 
          success: true,
          status: 'not_listed',
          message: 'Hotel not listed on Expedia' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expediaUrl = alias.platform_url;
    console.log(`Fetching Expedia rating from: ${expediaUrl}`);

    // Step 3: Call tri_angle actor with correct input format
    const runResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${EXPEDIA_ACTOR_ID}/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: expediaUrl }],
          maxReviews: 1, // We only need the rating, not all reviews
        }),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Apify run start error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false,
          status: 'error',
          error: 'Failed to start Apify run' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const runData: ApifyRunResponse = await runResponse.json();
    const runId = runData.data.id;
    console.log(`Apify Expedia run started: ${runId}`);

    // Wait for completion (3 min timeout)
    const datasetId = await waitForRun(runId, apiToken);
    
    const resultsResponse = await fetch(
      `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
    );
    
    if (!resultsResponse.ok) {
      throw new Error('Failed to fetch results');
    }

    const results: ExpediaResult[] = await resultsResponse.json();
    console.log(`Expedia results:`, JSON.stringify(results, null, 2));

    if (!results || results.length === 0) {
      // Update alias to mark as not found
      await supabase
        .from('hotel_aliases')
        .update({ resolution_status: 'not_listed', last_resolved_at: new Date().toISOString() })
        .eq('property_id', propertyId)
        .eq('source', 'expedia');

      return new Response(
        JSON.stringify({ 
          success: true,
          status: 'not_listed',
          message: 'No rating data found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = results[0];
    
    // Step 4: Extract rating and review count
    const rawRating = result.hotelOverallRating;
    const reviewCount = result.hotelReviewCount || 0;

    if (rawRating === null || rawRating === undefined) {
      return new Response(
        JSON.stringify({ 
          success: true,
          status: 'not_listed',
          message: 'No rating in response' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 5: Normalize to 0-10 scale (tri_angle returns 0-10 already)
    const scale = 10;
    const normalizedScore = parseFloat(rawRating.toFixed(2));

    // Step 6: Save to source_snapshots
    const { error: insertError } = await supabase.from('source_snapshots').insert({
      property_id: propertyId,
      source: 'expedia',
      score_raw: rawRating,
      score_scale: scale,
      review_count: reviewCount,
      normalized_score_0_10: normalizedScore,
      status: 'found',
    });

    if (insertError) {
      console.error('Error saving snapshot:', insertError);
    }

    // Update alias verification timestamp
    await supabase
      .from('hotel_aliases')
      .update({ 
        last_verified_at: new Date().toISOString(),
        resolution_status: 'verified'
      })
      .eq('property_id', propertyId)
      .eq('source', 'expedia');

    console.log(`Expedia rating saved: ${rawRating}/${scale} (${reviewCount} reviews)`);

    return new Response(
      JSON.stringify({
        success: true,
        status: 'found',
        rating: rawRating,
        reviewCount: reviewCount,
        scale: scale,
        normalizedScore: normalizedScore,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error fetching Expedia rating:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, status: 'error', error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
