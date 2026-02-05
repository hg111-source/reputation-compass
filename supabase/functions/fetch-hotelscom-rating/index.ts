import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HotelDetailsResponse {
  reviewInfo?: {
    overallValue?: string; // "9.0/10 Wonderful"
    property?: string; // "See all 1,111 reviews"
  };
  // Alternative locations for rating data in details response
  summary?: {
    overview?: {
      propertyRating?: {
        rating?: number;
        count?: number;
      };
    };
  };
  propertyContentSectionGroups?: {
    aboutThisProperty?: {
      propertyGuestRating?: string;
      propertyReviewCount?: number;
    };
  };
  // Direct rating fields
  guestRating?: number | string;
  guestReviewCount?: number;
  starRating?: number;
}

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      throw new Error('RAPIDAPI_KEY not configured');
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

    let targetHotelId = hotelId;

    // If no hotelId provided, look it up from hotel_aliases
    if (!targetHotelId) {
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

      // Extract hotel_id from platform_id or platform_url
      targetHotelId = alias.platform_id;
      
      // If no platform_id, try to extract from URL
      if (!targetHotelId && alias.platform_url) {
        // Hotels.com URLs: https://www.hotels.com/ho123456/
        const urlMatch = alias.platform_url.match(/\/ho(\d+)/);
        if (urlMatch) {
          targetHotelId = urlMatch[1];
        }
      }

      if (!targetHotelId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            status: 'no_hotel_id', 
            message: 'No Hotels.com hotel_id found. Re-resolve URLs to get the hotel ID.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Fetching Hotels.com rating for hotel_id: ${targetHotelId} using domain=US`);

    // Try /v2/hotels/details endpoint which includes ratings
    // Domain must be a valid country code: US, GB, DE, FR, etc.
    const detailsUrl = `https://hotels-com-provider.p.rapidapi.com/v2/hotels/details?hotel_id=${targetHotelId}&domain=US&locale=en_US`;
    
    console.log(`API URL: ${detailsUrl}`);
    
    const response = await fetch(detailsUrl, {
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
          JSON.stringify({ success: false, status: 'rate_limited', message: 'API rate limit reached' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`API request failed: ${response.status}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();
    console.log('API response:', JSON.stringify(data).substring(0, 1000));
    console.log('API response keys:', Object.keys(data || {}));
    
    // Log reviewInfo specifically since that's where ratings usually are
    if (data.reviewInfo) {
      console.log('reviewInfo:', JSON.stringify(data.reviewInfo).substring(0, 500));
    }

    // Try multiple locations for rating data
    let rating: number | null = null;
    let reviewCount = 0;
    
    // Method 1: reviewInfo.summary format (GraphQL style)
    if (data.reviewInfo?.summary) {
      console.log('reviewInfo.summary:', JSON.stringify(data.reviewInfo.summary));
      // Extract overall guest rating
      if (data.reviewInfo.summary.overallScoreWithDescriptionA11y?.value) {
        // Format: "9.0/10 Wonderful"
        rating = parseRating(data.reviewInfo.summary.overallScoreWithDescriptionA11y.value);
      }
      if (data.reviewInfo.summary.propertyReviewCountSecondary?.value) {
        // Format: "See all 1,111 reviews"
        reviewCount = parseReviewCount(data.reviewInfo.summary.propertyReviewCountSecondary.value);
      }
    }
    
    // Method 2: reviewInfo.overallValue format (direct)
    if (rating === null && data.reviewInfo?.overallValue) {
      rating = parseRating(data.reviewInfo.overallValue);
      reviewCount = parseReviewCount(data.reviewInfo?.property);
    }
    
    // Method 3: Direct guestRating field
    if (rating === null && data.guestRating !== undefined) {
      rating = typeof data.guestRating === 'number' 
        ? data.guestRating 
        : parseFloat(String(data.guestRating).replace(/[^0-9.]/g, ''));
      reviewCount = data.guestReviewCount || 0;
    }
    
    // Method 4: summary.overview.propertyRating
    if (rating === null && data.summary?.overview?.propertyRating) {
      rating = data.summary.overview.propertyRating.rating || null;
      reviewCount = data.summary.overview.propertyRating.count || 0;
    }

    console.log(`Parsed: rating=${rating}, reviewCount=${reviewCount}`);

    if (rating === null) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: 'not_found', 
          message: 'No rating found in API response',
          debug: { overallValue: data.reviewInfo?.overallValue }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hotels.com uses 10-point scale
    const scale = 10;

    // Save snapshot
    const { error: insertError } = await supabase.from('source_snapshots').insert({
      property_id: propertyId,
      source: 'expedia', // Store as expedia since they share the same reviews
      score_raw: rating,
      score_scale: scale,
      review_count: reviewCount,
      normalized_score_0_10: rating, // Already on 0-10 scale
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
