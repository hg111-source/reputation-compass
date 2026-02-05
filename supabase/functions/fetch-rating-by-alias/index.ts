import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APIFY_BASE_URL = 'https://api.apify.com/v2';

const APIFY_ACTORS: Record<string, string> = {
  tripadvisor: 'dbEyMBriog95Fv8CW', // maxcopell/tripadvisor
  booking: 'oeiQgfg5fsmIJB7Cn', // voyager/booking-scraper  
  expedia: 'wBnAOMgAtH92vVJri', // tri_angle/expedia-hotels-com-reviews-scraper
};

type ReviewSource = 'google' | 'tripadvisor' | 'booking' | 'expedia';

interface FetchRequest {
  propertyId: string;
  source: ReviewSource;
}

interface FetchResponse {
  success: boolean;
  status: 'found' | 'not_listed' | 'scrape_failed' | 'timeout' | 'no_alias';
  rating?: number | null;
  reviewCount?: number;
  scale?: number;
  platformName?: string;
  error?: string;
  debug: {
    duration_ms: number;
    used_alias: boolean;
    alias_status?: string;
    apify_run_id?: string;
  };
}

async function waitForApifyRun(runId: string, token: string, maxWaitMs = 180000): Promise<string> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`${APIFY_BASE_URL}/actor-runs/${runId}?token=${token}`);
    const data = await response.json();
    
    const status = data?.data?.status;
    
    if (status === 'SUCCEEDED') {
      return data.data.defaultDatasetId;
    }
    
    if (status === 'FAILED' || status === 'ABORTED') {
      throw new Error(`APIFY_RUN_${status}`);
    }
    
    if (status === 'TIMED-OUT') {
      throw new Error('APIFY_RUN_TIMEOUT');
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error('APIFY_WAIT_TIMEOUT');
}

// ============ GOOGLE RATING FETCH ============
async function fetchGoogleRating(
  placeId: string,
  apiKey: string
): Promise<{ rating: number | null; reviewCount: number; name: string }> {
  const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  detailsUrl.searchParams.set('place_id', placeId);
  detailsUrl.searchParams.set('fields', 'name,rating,user_ratings_total');
  detailsUrl.searchParams.set('key', apiKey);

  const response = await fetch(detailsUrl.toString());
  
  if (!response.ok) {
    throw new Error(`Google API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.status !== 'OK' || !data.result) {
    throw new Error(`Place not found: ${data.status}`);
  }

  return {
    rating: data.result.rating ?? null,
    reviewCount: data.result.user_ratings_total || 0,
    name: data.result.name,
  };
}

// ============ APIFY OTA RATING FETCH ============
async function fetchApifyRating(
  source: ReviewSource,
  platformUrl: string,
  apiToken: string
): Promise<{ rating: number | null; reviewCount: number; name: string; scale: number; runId: string }> {
  const actorId = APIFY_ACTORS[source];
  
  if (!actorId) {
    throw new Error(`Unknown source: ${source}`);
  }

  // Build input based on source - each actor has different input format
  let runBody: Record<string, unknown>;

  if (source === 'tripadvisor') {
    // maxcopell/tripadvisor uses startUrls array
    runBody = {
      startUrls: [{ url: platformUrl }],
      maxItems: 1,
    };
  } else if (source === 'booking') {
    // voyager/booking-scraper uses startUrls with hotel detail URLs
    runBody = {
      startUrls: [platformUrl],
      maxItems: 1,
      simple: true,
    };
  } else if (source === 'expedia') {
    // tri_angle/expedia-hotels-com-reviews-scraper uses startUrls
    runBody = {
      startUrls: [platformUrl],
    };
  } else {
    throw new Error(`Unsupported source: ${source}`);
  }

  const apifyUrl = `${APIFY_BASE_URL}/acts/${actorId}/runs?token=${apiToken}`;
  console.log(`Apify URL: ${apifyUrl.replace(apiToken, 'TOKEN_HIDDEN')}`);
  console.log(`Apify body:`, JSON.stringify(runBody));
  console.log(`Platform URL: ${platformUrl}`);

  const runResponse = await fetch(
    apifyUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(runBody),
    }
  );

  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    throw new Error(`Apify run start failed: ${runResponse.status} ${errorText}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data.id;

  console.log(`Apify run started: ${runId}`);

  // Wait for run to complete
  const datasetId = await waitForApifyRun(runId, apiToken);

  // Fetch results
  const resultsResponse = await fetch(
    `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
  );
  
  if (!resultsResponse.ok) {
    throw new Error('Failed to fetch Apify results');
  }

  const results = await resultsResponse.json();
  
  console.log(`Apify results count: ${results?.length || 0}`);
  if (results?.length > 0) {
    console.log(`First result keys:`, Object.keys(results[0]));
  }
  
  if (!results || results.length === 0) {
    throw new Error('No results from Apify');
  }

  const result = results[0];
  
  // Extract rating based on source - each actor returns different structure
  let rating: number | null = null;
  let reviewCount = 0;
  let scale = 5;
  let name = '';

  if (source === 'tripadvisor') {
    rating = result.rating ?? null;
    reviewCount = result.reviewsCount || result.numberOfReviews || result.reviewCount || 0;
    name = result.name || '';
    scale = 5;
  } else if (source === 'booking') {
    // voyager/booking-scraper returns: score, reviewCount, name
    rating = result.score ?? result.reviewScore ?? result.rating ?? null;
    reviewCount = result.reviewCount ?? result.numberOfReviews ?? result.reviews ?? 0;
    name = result.name ?? result.hotelName ?? '';
    scale = 10;
  } else if (source === 'expedia') {
    // tri_angle/expedia-hotels-com-reviews-scraper returns review data
    // We need to calculate average from reviews or get hotel info
    rating = result.rating ?? result.score ?? result.guestRating ?? null;
    reviewCount = result.reviewCount ?? result.totalReviews ?? results.length ?? 0;
    name = result.hotelName ?? result.name ?? '';
    scale = 10;
  }

  console.log(`Extracted: rating=${rating}, reviewCount=${reviewCount}, name=${name}`);

  return {
    rating,
    reviewCount,
    name,
    scale,
    runId,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { propertyId, source }: FetchRequest = await req.json();

    if (!propertyId || !source) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: 'scrape_failed',
          error: 'propertyId and source are required',
          debug: { duration_ms: Date.now() - startTime, used_alias: false }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching ${source} rating for property ${propertyId}`);

    // Get the alias for this property/source
    const { data: alias, error: aliasError } = await supabase
      .from('hotel_aliases')
      .select('*')
      .eq('property_id', propertyId)
      .eq('source', source)
      .maybeSingle();

    if (aliasError) {
      console.error('Error fetching alias:', aliasError);
    }

    // If no alias or not resolved, can't fetch rating
    if (!alias) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'no_alias',
          error: 'No alias found - run resolve-identity first',
          debug: { duration_ms: Date.now() - startTime, used_alias: false }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (alias.resolution_status === 'not_listed') {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'not_listed',
          debug: { 
            duration_ms: Date.now() - startTime, 
            used_alias: true,
            alias_status: alias.resolution_status
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (alias.resolution_status === 'needs_review') {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'scrape_failed',
          error: 'Alias needs manual review before fetching',
          debug: { 
            duration_ms: Date.now() - startTime, 
            used_alias: true,
            alias_status: alias.resolution_status
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (alias.resolution_status !== 'resolved') {
      return new Response(
        JSON.stringify({
          success: false,
          status: 'scrape_failed',
          error: `Invalid alias status: ${alias.resolution_status}`,
          debug: { 
            duration_ms: Date.now() - startTime, 
            used_alias: true,
            alias_status: alias.resolution_status
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch rating using the stable identifier (source_id_or_url)
    // Fallback to legacy columns for backward compatibility
    const sourceIdOrUrl = alias.source_id_or_url || alias.platform_url || alias.platform_id;
    
    let response: FetchResponse;

    try {
      if (source === 'google') {
        if (!googleApiKey) {
          throw new Error('GOOGLE_PLACES_API_KEY not configured');
        }
        // For Google, source_id_or_url should be the place_id
        const placeId = alias.platform_id || alias.source_id_or_url;
        if (!placeId) {
          throw new Error('No Google place_id in alias');
        }

        const result = await fetchGoogleRating(placeId, googleApiKey);
        
        // Store snapshot
        if (result.rating !== null) {
          const normalizedScore = (result.rating / 5) * 10;
          
          await supabase.from('source_snapshots').insert({
            property_id: propertyId,
            source: 'google',
            score_raw: result.rating,
            score_scale: 5,
            review_count: result.reviewCount,
            normalized_score_0_10: parseFloat(normalizedScore.toFixed(2)),
            status: 'found',
          });
        }

        response = {
          success: true,
          status: 'found',
          rating: result.rating,
          reviewCount: result.reviewCount,
          scale: 5,
          platformName: result.name,
          debug: { 
            duration_ms: Date.now() - startTime, 
            used_alias: true,
            alias_status: alias.resolution_status
          }
        };
      } else {
        // OTA sources use Apify - prefer source_id_or_url, fallback to platform_url
        if (!apifyToken) {
          throw new Error('APIFY_API_TOKEN not configured');
        }
        const platformUrl = alias.source_id_or_url || alias.platform_url;
        if (!platformUrl) {
          throw new Error(`No platform URL in alias for ${source}`);
        }

        const result = await fetchApifyRating(source, platformUrl, apifyToken);
        
        // Store snapshot
        if (result.rating !== null) {
          const normalizedScore = result.scale === 10 ? result.rating : (result.rating / result.scale) * 10;
          
          await supabase.from('source_snapshots').insert({
            property_id: propertyId,
            source,
            score_raw: result.rating,
            score_scale: result.scale,
            review_count: result.reviewCount,
            normalized_score_0_10: parseFloat(normalizedScore.toFixed(2)),
            status: 'found',
          });
        }

        response = {
          success: true,
          status: 'found',
          rating: result.rating,
          reviewCount: result.reviewCount,
          scale: result.scale,
          platformName: result.name,
          debug: { 
            duration_ms: Date.now() - startTime, 
            used_alias: true,
            alias_status: alias.resolution_status,
            apify_run_id: result.runId
          }
        };
      }
    } catch (fetchError) {
      const msg = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      
      let status: 'scrape_failed' | 'timeout' = 'scrape_failed';
      if (msg.includes('TIMEOUT') || msg.includes('timeout')) {
        status = 'timeout';
      }

      response = {
        success: false,
        status,
        error: msg,
        debug: { 
          duration_ms: Date.now() - startTime, 
          used_alias: true,
          alias_status: alias.resolution_status
        }
      };
    }

    console.log(`${source} rating fetch complete: ${response.status}`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error fetching rating:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        status: 'scrape_failed',
        error: errorMessage,
        debug: { duration_ms: Date.now() - startTime, used_alias: false }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
