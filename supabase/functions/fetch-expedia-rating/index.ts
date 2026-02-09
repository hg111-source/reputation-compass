import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    // No alias found - auto-resolve by calling resolve-identity (uses site:hotels.com for better coverage)
    if (!alias) {
      console.log('No Expedia alias found, auto-resolving via resolve-identity...');

      // Get property details for resolution
      const { data: property, error: propError } = await supabase
        .from('properties')
        .select('name, city, state')
        .eq('id', propertyId)
        .single();

      if (propError || !property) {
        throw new Error('Could not find property for auto-resolution');
      }

      console.log(`Auto-resolving Expedia for: ${property.name}, ${property.city}, ${property.state}`);

      // Call resolve-identity edge function (searches site:hotels.com which has better coverage than site:expedia.com)
      const resolveResponse = await fetch(`${supabaseUrl}/functions/v1/resolve-identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          propertyId,
          hotelName: property.name,
          city: property.city,
          state: property.state,
          sources: ['expedia'],
        }),
      });

      const resolveData = await resolveResponse.json();
      console.log('Resolve-identity result:', JSON.stringify(resolveData).substring(0, 500));

      if (!resolveData.success) {
        return new Response(
          JSON.stringify({ success: false, status: 'resolve_failed', message: resolveData.error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const expediaResolution = resolveData.resolutions?.find((r: { source: string }) => r.source === 'expedia');
      
      if (!expediaResolution || expediaResolution.status === 'not_listed') {
        return new Response(
          JSON.stringify({
            success: false,
            status: 'not_found',
            message: `Could not find ${property.name} on Expedia/Hotels.com`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (expediaResolution.status !== 'resolved') {
        return new Response(
          JSON.stringify({
            success: false,
            status: expediaResolution.status,
            message: `Resolution status: ${expediaResolution.status}`,
            candidates: expediaResolution.candidates,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // resolve-identity already upserts the alias, so just get the hotel_id
      let resolvedHotelId = expediaResolution.platformId;
      
      if (!resolvedHotelId && expediaResolution.platformUrl) {
        resolvedHotelId = extractHotelId(expediaResolution.platformUrl);
      }

      if (!resolvedHotelId) {
        return new Response(
          JSON.stringify({
            success: false,
            status: 'no_hotel_id',
            message: 'Resolved Expedia URL but could not extract hotel ID',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      var hotelId: string = resolvedHotelId;
      console.log(`Auto-resolved hotel_id via resolve-identity: ${hotelId}`);
    } else {
      // Alias exists - check its status

      // Hotel previously marked as not listed - re-resolve on retry using resolve-identity
      if (alias.resolution_status === 'not_listed') {
        console.log('Previously marked not_listed, re-resolving via resolve-identity...');

        const { data: property } = await supabase
          .from('properties')
          .select('name, city, state')
          .eq('id', propertyId)
          .single();

        if (property) {
          const resolveResponse = await fetch(`${supabaseUrl}/functions/v1/resolve-identity`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              propertyId,
              hotelName: property.name,
              city: property.city,
              state: property.state,
              sources: ['expedia'],
            }),
          });

          const resolveData = await resolveResponse.json();
          console.log('Re-resolve result:', JSON.stringify(resolveData).substring(0, 500));

          if (resolveData.success) {
            const expRes = resolveData.resolutions?.find((r: { source: string }) => r.source === 'expedia');
            if (expRes?.status === 'resolved') {
              const expediaHotelId = expRes.platformId || (expRes.platformUrl ? extractHotelId(expRes.platformUrl) : null);
              if (expediaHotelId) {
                var hotelId: string = expediaHotelId;
                console.log(`Re-resolved hotel_id: ${hotelId}`);
                // Fall through to fetch rating below
              }
            }
          }
        }

        // If re-resolution didn't find anything, still return not_listed
        if (typeof hotelId === 'undefined' || !hotelId) {
          return new Response(
            JSON.stringify({ success: true, status: 'not_listed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Not not_listed - get hotel_id from existing alias
        var hotelId: string = alias.platform_id || '';
        
        if (!hotelId && alias.platform_url) {
          hotelId = extractHotelId(alias.platform_url) || '';
          
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
      }
    }

    console.log(`Fetching Expedia rating for hotel_id: ${hotelId}`);

    // Step 2: Call RapidAPI reviews/scores endpoint
    const apiUrl = `https://hotels-com-provider.p.rapidapi.com/v2/hotels/reviews/scores?hotel_id=${hotelId}&locale=en_US&domain=US`;
    
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
    console.log(`RapidAPI response: ${JSON.stringify(data).substring(0, 1000)}`);
    
    // Step 3: Parse the response from reviews/scores endpoint
    // API returns an array - use first element if it's an array
    const reviewData = Array.isArray(data) ? data[0] : data;
    
    let rating: number | null = null;
    let reviewCount = 0;

    // Handle empty array or null response
    if (!reviewData) {
      console.log('No review data in response (empty array or null)');
    } else {
      // The reviews/scores endpoint returns overallScoreWithDescriptionA11y
      // Format: "8,8/10 Excellent" (European comma) or "8.8/10 Excellent"
      if (reviewData.overallScoreWithDescriptionA11y?.value) {
        rating = parseRating(reviewData.overallScoreWithDescriptionA11y.value);
        console.log(`Found overallScoreWithDescriptionA11y: ${reviewData.overallScoreWithDescriptionA11y.value} -> ${rating}`);
      }
      
      // Fallback paths
      if (rating === null && reviewData.overallScore) {
        rating = parseRating(reviewData.overallScore);
        console.log(`Found overallScore: ${reviewData.overallScore} -> ${rating}`);
      }
      
      if (rating === null && reviewData.score !== undefined) {
        rating = parseFloat(reviewData.score);
        console.log(`Found score: ${reviewData.score} -> ${rating}`);
      }

      // Find review count - "901 reviews" or "fullDescription: 901 reviews" format
      if (reviewData.propertyReviewCountDetails?.fullDescription) {
        reviewCount = parseReviewCount(reviewData.propertyReviewCountDetails.fullDescription);
      } else if (reviewData.propertyReviewCountDetails?.shortDescription) {
        reviewCount = parseReviewCount(reviewData.propertyReviewCountDetails.shortDescription);
      } else if (reviewData.totalCount !== undefined) {
        reviewCount = parseInt(reviewData.totalCount);
      } else if (reviewData.reviewCount !== undefined) {
        reviewCount = parseInt(reviewData.reviewCount);
      }
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
