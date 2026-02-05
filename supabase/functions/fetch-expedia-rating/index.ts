import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractRatingFromHtml(html: string): { rating: number | null; reviewCount: number; hotelName: string | null } {
  let rating: number | null = null;
  let reviewCount = 0;
  let hotelName: string | null = null;

  // Try JSON-LD structured data
  const jsonLdMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  
  if (jsonLdMatches) {
    for (const match of jsonLdMatches) {
      try {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '').trim();
        const data = JSON.parse(jsonContent);
        const items = Array.isArray(data) ? data : [data];
        
        for (const item of items) {
          if (item['@type'] === 'Hotel' || item['@type'] === 'LodgingBusiness') {
            hotelName = item.name || hotelName;
            if (item.aggregateRating) {
              rating = parseFloat(item.aggregateRating.ratingValue);
              reviewCount = parseInt(item.aggregateRating.reviewCount) || 0;
            }
          }
        }
      } catch (_e) { /* continue */ }
    }
  }

  // Fallback patterns
  if (rating === null) {
    const ratingMatch = html.match(/ratingValue["']?\s*[:=]\s*["']?([\d.]+)/i);
    if (ratingMatch) rating = parseFloat(ratingMatch[1]);
    
    const reviewMatch = html.match(/reviewCount["']?\s*[:=]\s*["']?(\d+)/i);
    if (reviewMatch) reviewCount = parseInt(reviewMatch[1]);
  }

  if (rating === null) {
    const scorePattern = html.match(/([\d.]+)\s*\/\s*10\s*(?:Exceptional|Wonderful|Very Good|Good|Pleasant)/i);
    if (scorePattern) rating = parseFloat(scorePattern[1]);
  }

  return { rating, reviewCount, hotelName };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Check hotel_aliases for resolved Expedia URL
    const { data: alias, error: aliasError } = await supabase
      .from('hotel_aliases')
      .select('platform_url, resolution_status')
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

    console.log(`Fetching: ${alias.platform_url}`);

    const response = await fetch(alias.platform_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, status: 'error', error: `HTTP ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    const { rating, reviewCount, hotelName } = extractRatingFromHtml(html);

    if (rating === null) {
      return new Response(
        JSON.stringify({ success: false, status: 'not_found', message: 'Rating not found in page' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save snapshot
    await supabase.from('source_snapshots').insert({
      property_id: propertyId,
      source: 'expedia',
      score_raw: rating,
      score_scale: 10,
      review_count: reviewCount,
      normalized_score_0_10: rating,
      status: 'found',
    });

    // Update alias
    await supabase
      .from('hotel_aliases')
      .update({ last_verified_at: new Date().toISOString(), resolution_status: 'verified', source_name_raw: hotelName })
      .eq('property_id', propertyId)
      .eq('source', 'expedia');

    console.log(`Expedia: ${rating}/10 (${reviewCount} reviews)`);

    return new Response(
      JSON.stringify({ success: true, status: 'found', rating, reviewCount, scale: 10 }),
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
