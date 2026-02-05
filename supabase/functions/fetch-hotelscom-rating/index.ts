import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hotels.com Review Scraper - same reviews as Expedia (both owned by Expedia Group)
const HOTELS_COM_ACTOR_ID = 'merRpWJCABv7fb6Mf';

function parseRating(overallValue: string | undefined): number | null {
  if (!overallValue) return null;
  // Parse "9.0/10 Wonderful" -> 9.0
  const match = overallValue.match(/^([\d.]+)\/10/);
  return match ? parseFloat(match[1]) : null;
}

function parseReviewCount(property: string | undefined): number {
  if (!property) return 0;
  // Parse "See all 1,111 reviews" -> 1111
  const match = property.match(/See all ([\d,]+) reviews/i);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''), 10);
  }
  return 0;
}

async function pollActorRun(apiToken: string, runId: string, maxWaitMs = 180000): Promise<any> {
  const startTime = Date.now();
  const pollInterval = 5000;

  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`);
    const runInfo = await response.json();
    
    console.log(`Apify poll status: ${runInfo.data?.status}`);

    if (runInfo.data?.status === 'SUCCEEDED') {
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

async function fetchViaApify(apiToken: string, platformUrl: string): Promise<{ rating: number | null; reviewCount: number }> {
  console.log(`Falling back to Apify scraper for: ${platformUrl}`);
  
  // Try both startUrls format (common for Apify actors)
  const actorInput = {
    startUrls: [{ url: platformUrl }],
    maxReviews: 1,
  };

  console.log(`Apify actor input: ${JSON.stringify(actorInput)}`);

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
    console.error(`Apify error response: ${errorText}`);
    throw new Error(`Apify actor start failed: ${runResponse.status} - ${errorText}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data?.id;

  if (!runId) {
    throw new Error('No Apify run ID returned');
  }

  console.log(`Apify Hotels.com run started: ${runId}`);
  const results = await pollActorRun(apiToken, runId);
  
  console.log(`Apify returned ${results?.length || 0} results`);
  
  if (!results || results.length === 0) {
    return { rating: null, reviewCount: 0 };
  }

  const hotelData = results[0];
  let rating: number | null = null;
  let reviewCount = 0;

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

  console.log(`Apify extracted: rating=${rating}, reviewCount=${reviewCount}`);
  return { rating, reviewCount };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    const apifyToken = Deno.env.get('APIFY_API_TOKEN');
    
    if (!rapidApiKey && !apifyToken) {
      throw new Error('Neither RAPIDAPI_KEY nor APIFY_API_TOKEN configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { propertyId, hotelId } = await req.json();

    if (!propertyId) {
      return new Response(
        JSON.stringify({ error: 'propertyId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get alias info
    const { data: alias, error: aliasError } = await supabase
      .from('hotel_aliases')
      .select('platform_id, platform_url, resolution_status')
      .eq('property_id', propertyId)
      .eq('source', 'expedia')
      .maybeSingle();

    if (aliasError) {
      console.error('Error fetching alias:', aliasError);
      throw new Error('Database error');
    }

    if (!alias) {
      return new Response(
        JSON.stringify({ success: false, status: 'no_alias', message: 'No Hotels.com alias found. Run Resolve URLs first.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (alias.resolution_status === 'not_listed') {
      return new Response(
        JSON.stringify({ success: true, status: 'not_listed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let targetHotelId = hotelId || alias.platform_id;
    const platformUrl = alias.platform_url;
    
    // If no platform_id, try to extract from URL
    if (!targetHotelId && platformUrl) {
      // Hotels.com URLs: https://www.hotels.com/ho123456/
      let urlMatch = platformUrl.match(/\/ho(\d+)/);
      if (urlMatch) {
        targetHotelId = urlMatch[1];
      }
      
      // Expedia URLs: https://www.expedia.com/...-Hotels-Name.h123456.Hotel-Information
      if (!targetHotelId) {
        urlMatch = platformUrl.match(/\.h(\d+)\./);
        if (urlMatch) {
          targetHotelId = urlMatch[1];
        }
      }
    }

    let rating: number | null = null;
    let reviewCount = 0;
    let usedApify = false;

    // Method 1: Try RapidAPI first (faster)
    if (rapidApiKey && targetHotelId) {
      console.log(`Trying RapidAPI for hotel_id: ${targetHotelId}`);
      
      const detailsUrl = `https://hotels-com-provider.p.rapidapi.com/v2/hotels/details?hotel_id=${targetHotelId}&domain=US&locale=en_US`;
      
      try {
        const response = await fetch(detailsUrl, {
          method: 'GET',
          headers: {
            'x-rapidapi-host': 'hotels-com-provider.p.rapidapi.com',
            'x-rapidapi-key': rapidApiKey,
          },
        });

        if (response.ok) {
          const data: any = await response.json();
          
          // Extract rating from reviewInfo.summary
          if (data.reviewInfo?.summary?.overallScoreWithDescriptionA11y?.value) {
            rating = parseRating(data.reviewInfo.summary.overallScoreWithDescriptionA11y.value);
          }
          if (data.reviewInfo?.summary?.propertyReviewCountDetails?.shortDescription) {
            reviewCount = parseReviewCount(data.reviewInfo.summary.propertyReviewCountDetails.shortDescription);
          }
          
          console.log(`RapidAPI result: rating=${rating}, reviewCount=${reviewCount}`);
        }
      } catch (err) {
        console.log(`RapidAPI failed: ${err}`);
      }
    }

    // Method 2: Fall back to Apify scraper if RapidAPI has no data
    if (rating === null && apifyToken && platformUrl) {
      console.log('RapidAPI returned no rating, falling back to Apify scraper...');
      usedApify = true;
      
      try {
        const apifyResult = await fetchViaApify(apifyToken, platformUrl);
        rating = apifyResult.rating;
        reviewCount = apifyResult.reviewCount;
      } catch (err) {
        console.error('Apify fallback failed:', err);
      }
    }

    if (rating === null) {
      // Save a snapshot with no_data status so the UI can show this
      await supabase.from('source_snapshots').insert({
        property_id: propertyId,
        source: 'expedia',
        score_raw: null,
        score_scale: 10,
        review_count: 0,
        normalized_score_0_10: null,
        status: 'no_data',
      });

      return new Response(
        JSON.stringify({ 
          success: true,  // Request succeeded, but no reviews available
          status: 'no_data', 
          message: 'Hotel has no reviews on Hotels.com/Expedia',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hotels.com uses 10-point scale
    const scale = 10;

    // Save snapshot
    const { error: insertError } = await supabase.from('source_snapshots').insert({
      property_id: propertyId,
      source: 'expedia',
      score_raw: rating,
      score_scale: scale,
      review_count: reviewCount,
      normalized_score_0_10: rating,
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
        resolution_status: 'verified',
      })
      .eq('property_id', propertyId)
      .eq('source', 'expedia');

    console.log(`Hotels.com (Expedia): ${rating}/${scale} (${reviewCount} reviews) via ${usedApify ? 'Apify' : 'RapidAPI'}`);

    return new Response(
      JSON.stringify({ success: true, status: 'found', rating, reviewCount, scale, source: usedApify ? 'apify' : 'rapidapi' }),
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
