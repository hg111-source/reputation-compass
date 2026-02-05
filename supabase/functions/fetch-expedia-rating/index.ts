import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Parse rating from European format "8,8/10 Excellent" -> 8.8
 * Also handles standard format "8.8/10 Excellent"
 */
function parseRating(ratingStr: string | undefined): number | null {
  if (!ratingStr) return null;
  
  // Replace European comma with decimal point: "8,8" -> "8.8"
  const normalized = ratingStr.replace(',', '.');
  
  // Extract number before "/10": "8.8/10 Excellent" -> 8.8
  const match = normalized.match(/^([\d.]+)\s*\/\s*10/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Parse review count from "901 reviews" or "See all 901 reviews" -> 901
 */
function parseReviewCount(countStr: string | undefined): number {
  if (!countStr) return 0;
  
  // Match various formats: "901 reviews", "See all 901 reviews", "901"
  const match = countStr.match(/([\d,]+)\s*reviews?/i) || countStr.match(/^([\d,]+)$/);
  if (match) {
    return parseInt(match[1].replace(/,/g, ''), 10);
  }
  return 0;
}

/**
 * Extract hotel_id from Expedia/Hotels.com URLs
 */
function extractHotelId(url: string): string | null {
  // Hotels.com: /ho123456/
  const hoMatch = url.match(/\/ho(\d+)/);
  if (hoMatch) return hoMatch[1];
  
  // Expedia: selected=123456 or hotelId=123456
  try {
    const urlObj = new URL(url);
    const selected = urlObj.searchParams.get('selected');
    if (selected) return selected;
    
    const hotelId = urlObj.searchParams.get('hotelId');
    if (hotelId) return hotelId;
  } catch {
    // URL parsing failed, try regex
    const selectedMatch = url.match(/selected=(\d+)/);
    if (selectedMatch) return selectedMatch[1];
    
    const hotelIdMatch = url.match(/hotelId=(\d+)/);
    if (hotelIdMatch) return hotelIdMatch[1];
  }
  
  // Expedia pattern: .h123456.
  const hMatch = url.match(/\.h(\d+)\./);
  if (hMatch) return hMatch[1];
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    
    if (!rapidApiKey) {
      throw new Error('RAPIDAPI_KEY is not configured');
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

    // Step 1: Get hotel_id from hotel_aliases table
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

    // No alias found - need to run URL resolution first
    if (!alias) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: 'no_alias', 
          message: 'No Expedia alias found. Run "Resolve URLs" first.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hotel marked as not listed on platform
    if (alias.resolution_status === 'not_listed') {
      return new Response(
        JSON.stringify({ success: true, status: 'not_listed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get hotel_id - either from platform_id or extract from URL
    let hotelId = alias.platform_id;
    
    if (!hotelId && alias.platform_url) {
      hotelId = extractHotelId(alias.platform_url);
      
      // Save the extracted ID for next time
      if (hotelId) {
        console.log(`Extracted hotel_id ${hotelId} from URL, saving to alias`);
        await supabase
          .from('hotel_aliases')
          .update({ platform_id: hotelId })
          .eq('property_id', propertyId)
          .eq('source', 'expedia');
      }
    }
    
    if (!hotelId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: 'no_hotel_id', 
          message: 'No hotel ID found. Re-run "Resolve URLs" to extract ID.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching Expedia rating for hotel_id: ${hotelId}`);

    // Step 2: Call RapidAPI details endpoint (has reviewInfo with rating data)
    // Add check-in/check-out dates as some APIs require them
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    const chkin = tomorrow.toISOString().split('T')[0];
    const chkout = dayAfter.toISOString().split('T')[0];
    
    const apiUrl = `https://hotels-com-provider.p.rapidapi.com/v2/hotels/details?hotel_id=${hotelId}&locale=en_US&domain=US&checkin_date=${chkin}&checkout_date=${chkout}`;
    
    console.log(`RapidAPI URL: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'hotels-com-provider.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`RapidAPI error: ${response.status} - ${errorText}`);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, status: 'rate_limited', message: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`RapidAPI request failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Log the response structure for debugging
    console.log(`RapidAPI response keys: ${JSON.stringify(Object.keys(data || {}))}`);
    if (data.reviewInfo) {
      console.log(`RapidAPI reviewInfo keys: ${JSON.stringify(Object.keys(data.reviewInfo || {}))}`);
      console.log(`RapidAPI reviewInfo.summary: ${JSON.stringify(data.reviewInfo?.summary || {})}`);
    }
    
    // Step 3: Parse the response - details endpoint uses reviewInfo.summary structure
    let rating: number | null = null;
    let reviewCount = 0;

    // Path 1: reviewInfo.summary.overallScoreWithDescriptionA11y (e.g., "8.8/10 Excellent")
    if (data.reviewInfo?.summary?.overallScoreWithDescriptionA11y?.value) {
      rating = parseRating(data.reviewInfo.summary.overallScoreWithDescriptionA11y.value);
      console.log(`Found reviewInfo.summary.overallScoreWithDescriptionA11y: ${data.reviewInfo.summary.overallScoreWithDescriptionA11y.value} -> ${rating}`);
    }
    
    // Path 2: summary.overallScoreWithDescriptionA11y (flat structure)
    if (rating === null && data.summary?.overallScoreWithDescriptionA11y?.value) {
      rating = parseRating(data.summary.overallScoreWithDescriptionA11y.value);
      console.log(`Found summary.overallScoreWithDescriptionA11y: ${data.summary.overallScoreWithDescriptionA11y.value} -> ${rating}`);
    }
    
    // Path 3: Direct score fields
    if (rating === null && data.reviewInfo?.summary?.score) {
      rating = parseFloat(data.reviewInfo.summary.score);
      console.log(`Found reviewInfo.summary.score: ${data.reviewInfo.summary.score} -> ${rating}`);
    }
    
    if (rating === null && data.reviewInfo?.summary?.averageOverallRating?.raw) {
      rating = parseFloat(data.reviewInfo.summary.averageOverallRating.raw);
      console.log(`Found reviewInfo.summary.averageOverallRating.raw: ${data.reviewInfo.summary.averageOverallRating.raw} -> ${rating}`);
    }

    // Find review count from reviewInfo.summary
    if (data.reviewInfo?.summary?.propertyReviewCountDetails?.shortDescription) {
      reviewCount = parseReviewCount(data.reviewInfo.summary.propertyReviewCountDetails.shortDescription);
    } else if (data.reviewInfo?.summary?.reviewCount) {
      reviewCount = parseInt(data.reviewInfo.summary.reviewCount);
    } else if (data.reviewInfo?.summary?.totalCount?.raw) {
      reviewCount = parseInt(data.reviewInfo.summary.totalCount.raw);
    }

    console.log(`Parsed result: rating=${rating}, reviewCount=${reviewCount}`);

    // Step 4: Handle no data case
    if (rating === null) {
      // Save a snapshot with no_data status
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
          success: true,
          status: 'no_data', 
          message: 'No rating data available from API',
          hotelId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 5: Save successful result to source_snapshots
    const { error: insertError } = await supabase.from('source_snapshots').insert({
      property_id: propertyId,
      source: 'expedia',
      score_raw: rating,
      score_scale: 10,
      review_count: reviewCount,
      normalized_score_0_10: rating, // Already on 10-point scale
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

    console.log(`Expedia: ${rating}/10 (${reviewCount} reviews) for hotel_id ${hotelId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: 'found', 
        rating, 
        reviewCount, 
        scale: 10,
        hotelId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
