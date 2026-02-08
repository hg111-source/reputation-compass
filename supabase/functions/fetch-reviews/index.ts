import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const APIFY_BASE_URL = 'https://api.apify.com/v2';
const RAPIDAPI_HOST = 'hotels-com-provider.p.rapidapi.com';

const ACTORS = {
  tripadvisor: 'dbEyMBriog95Fv8CW',
  google: 'nwua9Gu5YrADL7ZDj',
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

/**
 * Fetch Expedia/Hotels.com reviews via RapidAPI reviews/list endpoint.
 * Uses the hotel_aliases table to get the platform_id (Hotels.com hotel ID).
 */
async function fetchExpediaReviews(
  rapidApiKey: string,
  propertyId: string,
  supabase: any,
  maxReviews: number
): Promise<{ reviews: any[]; hotelName: string }> {
  // Get the Expedia hotel_id from hotel_aliases
  const { data: alias, error: aliasError } = await supabase
    .from('hotel_aliases')
    .select('platform_id, platform_url')
    .eq('property_id', propertyId)
    .eq('source', 'expedia')
    .not('resolution_status', 'eq', 'not_listed')
    .maybeSingle();

  if (aliasError || !alias?.platform_id) {
    console.log(`No Expedia alias/hotel_id for property ${propertyId}, skipping`);
    return { reviews: [], hotelName: '' };
  }

  const hotelId = alias.platform_id;
  console.log(`Fetching Expedia reviews for hotel_id: ${hotelId}`);

  const url = `https://${RAPIDAPI_HOST}/v2/hotels/reviews/list?hotel_id=${hotelId}&locale=en_US&domain=US&page_number=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': rapidApiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Expedia reviews API error: ${response.status} - ${errorText}`);
    throw new Error(`Expedia reviews API failed: ${response.status}`);
  }

  const data = await response.json();
  console.log(`Expedia reviews response keys: ${Object.keys(data).join(', ')}`);
  console.log(`Expedia reviews response sample: ${JSON.stringify(data).substring(0, 1500)}`);

  // Parse reviews from response - the structure may vary
  const reviews: any[] = [];
  
  // Parse reviews - response structure: { reviewInfo: { reviews: [...] } }
  const reviewItems = data.reviewInfo?.reviews || data.reviewData?.reviews || data.reviews || [];
  
  for (const r of reviewItems) {
    const text = r.text || r.reviewText || '';
    const title = r.title || '';
    const fullText = title && title.length > 0 ? `${title}. ${text}` : text;
    
    // Parse rating from "10/10 Exceptional" format
    let rating: number | null = null;
    const ratingStr = r.reviewScoreWithDescription?.value || r.rating;
    if (ratingStr) {
      const match = String(ratingStr).replace(',', '.').match(/([\d.]+)/);
      if (match) rating = parseFloat(match[1]);
    }

    // Parse reviewer from footer
    const reviewer = r.reviewFooter?.messages?.[0]?.text?.text || r.reviewerName || null;
    
    if (fullText.length > 10) {
      reviews.push({
        text: fullText,
        rating,
        date: r.submissionTimeLocalized || r.stayDate || null,
        reviewer,
      });
    }
    
    if (reviews.length >= maxReviews) break;
  }

  console.log(`Parsed ${reviews.length} Expedia reviews for hotel_id ${hotelId}`);
  return { reviews, hotelName: '' };
}

// Retry helper
async function retryOperation<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  label: string = 'operation'
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`${label} attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastError.message}`);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
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
      ? ['tripadvisor', 'google', 'expedia'] 
      : [platform];

    const results: { platform: string; reviews: any[]; hotelName: string }[] = [];
    const errors: { platform: string; error: string }[] = [];

    // Get RapidAPI key for Expedia
    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY') || '';

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
        } else if (p === 'expedia') {
          if (!rapidApiKey) {
            console.warn('RAPIDAPI_KEY not configured, skipping Expedia reviews');
            errors.push({ platform: 'expedia', error: 'RAPIDAPI_KEY not configured' });
          } else {
            const expediaResult = await fetchExpediaReviews(rapidApiKey, propertyId, supabase, maxReviews);
            results.push({ platform: 'expedia', ...expediaResult });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error fetching from ${p}:`, msg);
        errors.push({ platform: p, error: msg });
      }
    }

    let totalReviews = 0;
    const saveErrors: { platform: string; error: string }[] = [];

    // Store reviews for each platform — with retry and atomic save
    for (const result of results) {
      if (result.reviews.length === 0) continue;

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

      if (reviewsToInsert.length === 0) continue;

      try {
        await retryOperation(async () => {
          // Delete old reviews
          const { error: deleteError } = await supabase
            .from('review_texts')
            .delete()
            .eq('property_id', propertyId)
            .eq('platform', result.platform);

          if (deleteError) {
            throw new Error(`Delete failed: ${deleteError.message}`);
          }

          // Insert new reviews
          const { error: insertError } = await supabase
            .from('review_texts')
            .insert(reviewsToInsert);

          if (insertError) {
            throw new Error(`Insert failed: ${insertError.message}`);
          }

          // Verify save by counting
          const { count, error: countError } = await supabase
            .from('review_texts')
            .select('*', { count: 'exact', head: true })
            .eq('property_id', propertyId)
            .eq('platform', result.platform);

          if (countError) {
            throw new Error(`Verification query failed: ${countError.message}`);
          }

          if ((count || 0) < reviewsToInsert.length) {
            throw new Error(`Verification failed: expected ${reviewsToInsert.length} reviews, found ${count}`);
          }

          console.log(`✅ Verified ${count} ${result.platform} reviews saved for ${propertyId}`);
        }, 2, `save-${result.platform}-reviews`);

        totalReviews += reviewsToInsert.length;
      } catch (saveErr) {
        const msg = saveErr instanceof Error ? saveErr.message : String(saveErr);
        console.error(`❌ Failed to save ${result.platform} reviews after retries:`, msg);
        saveErrors.push({ platform: result.platform, error: msg });
      }
    }

    return new Response(
      JSON.stringify({
        success: saveErrors.length === 0 && errors.length === 0,
        reviewCount: totalReviews,
        platforms: results.map(r => ({ platform: r.platform, count: r.reviews.length })),
        fetchErrors: errors.length > 0 ? errors : undefined,
        saveErrors: saveErrors.length > 0 ? saveErrors : undefined,
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
