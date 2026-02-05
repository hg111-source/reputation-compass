import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hotels.com Review Scraper - same reviews as Expedia (both owned by Expedia Group)
const HOTELS_COM_ACTOR_ID = 'merRpWJCABv7fb6Mf';

async function pollActorRun(apiToken: string, runId: string, maxWaitMs = 180000): Promise<any> {
  const startTime = Date.now();
  const pollInterval = 5000;

  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`);
    const runInfo = await response.json();
    
    console.log(`Poll status: ${runInfo.data?.status}`);

    if (runInfo.data?.status === 'SUCCEEDED') {
      // Fetch dataset items
      const datasetId = runInfo.data.defaultDatasetId;
      const datasetResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`
      );
      return await datasetResponse.json();
    }

    if (runInfo.data?.status === 'FAILED' || runInfo.data?.status === 'ABORTED') {
      throw new Error(`Actor run ${runInfo.data?.status}`);
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Actor run timed out');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiToken = Deno.env.get('APIFY_API_TOKEN');
    if (!apiToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { propertyId } = await req.json();
    
    if (!propertyId) {
      return new Response(
        JSON.stringify({ error: 'propertyId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check hotel_aliases for resolved Hotels.com URL (stored as expedia source)
    const { data: alias, error: aliasError } = await supabase
      .from('hotel_aliases')
      .select('platform_url, resolution_status, source_name_raw')
      .eq('property_id', propertyId)
      .eq('source', 'expedia')
      .single();

    if (aliasError && aliasError.code !== 'PGRST116') {
      throw new Error('Database error');
    }

    if (!alias || !alias.platform_url) {
      return new Response(
        JSON.stringify({ success: false, status: 'no_alias', message: 'Resolve URLs first' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (alias.resolution_status === 'not_listed') {
      return new Response(
        JSON.stringify({ success: true, status: 'not_listed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify it's a Hotels.com URL
    if (!alias.platform_url.includes('hotels.com')) {
      console.log(`URL is not Hotels.com: ${alias.platform_url}`);
      return new Response(
        JSON.stringify({ success: false, status: 'invalid_url', message: 'URL is not Hotels.com - re-resolve URLs' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching Hotels.com reviews for: ${alias.platform_url}`);

    // Call the Hotels.com Review Scraper actor
    const actorInput = {
      productUrls: [alias.platform_url],
      maxItems: 1, // We just need the overall rating
    };

    console.log('Starting Hotels.com actor with input:', JSON.stringify(actorInput));

    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${HOTELS_COM_ACTOR_ID}/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error(`Actor start failed: ${runResponse.status} - ${errorText}`);
      throw new Error(`Failed to start actor: ${runResponse.status}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data?.id;

    if (!runId) {
      throw new Error('No run ID returned from actor');
    }

    console.log(`Actor run started: ${runId}`);

    // Poll for completion
    const results = await pollActorRun(apiToken, runId);
    
    console.log(`Actor returned ${results?.length || 0} results`);
    
    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ success: false, status: 'not_found', message: 'No results from Hotels.com' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract rating from Hotels.com data
    // The actor returns review data - look for overall rating
    const hotelData = results[0];
    console.log('Hotels.com result keys:', Object.keys(hotelData || {}));
    
    // Hotels.com Review Scraper returns individual reviews
    // The overall rating might be in hotelInfo or similar field
    let rating: number | null = null;
    let reviewCount = 0;
    let hotelName: string | null = null;

    // Check various possible field names for rating
    if (hotelData.hotelOverallRating) {
      rating = parseFloat(hotelData.hotelOverallRating);
    } else if (hotelData.overallRating) {
      rating = parseFloat(hotelData.overallRating);
    } else if (hotelData.rating) {
      rating = parseFloat(hotelData.rating);
    } else if (hotelData.hotelInfo?.rating) {
      rating = parseFloat(hotelData.hotelInfo.rating);
    } else if (hotelData.guestRating) {
      rating = parseFloat(hotelData.guestRating);
    }

    // Check for review count
    if (hotelData.hotelReviewCount) {
      reviewCount = parseInt(hotelData.hotelReviewCount);
    } else if (hotelData.reviewCount) {
      reviewCount = parseInt(hotelData.reviewCount);
    } else if (hotelData.totalReviews) {
      reviewCount = parseInt(hotelData.totalReviews);
    } else if (hotelData.hotelInfo?.reviewCount) {
      reviewCount = parseInt(hotelData.hotelInfo.reviewCount);
    }

    // Get hotel name
    hotelName = hotelData.hotelName || hotelData.name || hotelData.hotelInfo?.name || null;

    console.log(`Extracted: rating=${rating}, reviewCount=${reviewCount}, name=${hotelName}`);
    console.log('Full result sample:', JSON.stringify(hotelData).substring(0, 500));

    if (rating === null) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: 'not_found', 
          message: 'Rating not found in Hotels.com response',
          debug: Object.keys(hotelData || {})
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hotels.com uses 10-point scale
    const scale = 10;
    const normalizedScore = rating;

    // Save snapshot
    const { error: insertError } = await supabase.from('source_snapshots').insert({
      property_id: propertyId,
      source: 'expedia', // Store as expedia since they share the same reviews
      score_raw: rating,
      score_scale: scale,
      review_count: reviewCount,
      normalized_score_0_10: parseFloat(normalizedScore.toFixed(2)),
      status: 'found',
    });

    if (insertError) {
      console.error('Error saving snapshot:', insertError);
    }

    // Update alias
    await supabase
      .from('hotel_aliases')
      .update({ 
        last_verified_at: new Date().toISOString(), 
        resolution_status: 'verified', 
        source_name_raw: hotelName 
      })
      .eq('property_id', propertyId)
      .eq('source', 'expedia');

    console.log(`Hotels.com (Expedia): ${rating}/${scale} (${reviewCount} reviews)`);

    return new Response(
      JSON.stringify({ success: true, status: 'found', rating, reviewCount, scale }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, status: 'error', error: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
