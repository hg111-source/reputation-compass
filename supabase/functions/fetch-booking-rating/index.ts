import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { analyzeHotelMatch, generateSearchQueries } from "../_shared/hotelNameUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

async function trySearch(searchQuery: string, apiToken: string): Promise<BookingResult[] | null> {
  console.log(`Booking.com trying search: "${searchQuery}"`);
  
  try {
    const runResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${BOOKING_ACTOR_ID}/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search: searchQuery,
          maxItems: 5, // Get a few results to find best match
          simple: true,
        }),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Apify run start error:', errorText);
      return null;
    }

    const runData: ApifyRunResponse = await runResponse.json();
    const runId = runData.data.id;
    
    console.log(`Apify Booking.com run started: ${runId}`);

    const datasetId = await waitForRun(runId, apiToken);
    
    const resultsResponse = await fetch(
      `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
    );
    
    if (!resultsResponse.ok) {
      return null;
    }

    const results: BookingResult[] = await resultsResponse.json();
    return results;
  } catch (error) {
    console.error(`Search failed for "${searchQuery}":`, error);
    return null;
  }
}

// Find best matching hotel from results using word-based matching with logging
function findBestMatch(results: BookingResult[], hotelName: string): BookingResult | null {
  if (!results || results.length === 0) return null;
  
  // Use the word-based hotel name matching with detailed analysis
  for (const result of results) {
    if (result.name) {
      const matchResult = analyzeHotelMatch(hotelName, result.name);
      console.log(`Analyzing: "${result.name}" vs "${hotelName}"`);
      console.log(`  → ${matchResult.reason}`);
      
      if (matchResult.isMatch) {
        console.log(`  ✓ MATCH`);
        return result;
      }
    }
  }
  
  // Return first result if no good match
  console.log(`No exact match, using first result: ${results[0].name}`);
  return results[0];
}

// Try direct URL scraping
async function tryDirectUrl(startUrl: string, apiToken: string): Promise<BookingResult | null> {
  console.log(`Booking.com trying direct URL: "${startUrl}"`);
  
  try {
    const runResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${BOOKING_ACTOR_ID}/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: startUrl }],
          maxItems: 1,
          simple: true,
        }),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error('Apify run start error:', errorText);
      return null;
    }

    const runData: ApifyRunResponse = await runResponse.json();
    const runId = runData.data.id;
    
    console.log(`Apify Booking.com direct URL run started: ${runId}`);

    const datasetId = await waitForRun(runId, apiToken);
    
    const resultsResponse = await fetch(
      `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
    );
    
    if (!resultsResponse.ok) {
      return null;
    }

    const results: BookingResult[] = await resultsResponse.json();
    return results && results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error(`Direct URL fetch failed:`, error);
    return null;
  }
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { propertyId, hotelName: directHotelName, city: directCity, startUrl: directStartUrl } = await req.json();

    let hotelName: string;
    let city: string;
    let startUrl: string | null = null;

    // Support both old (hotelName, city) and new (propertyId) interfaces
    if (propertyId) {
      // New interface: look up property and alias data
      const { data: property, error: propError } = await supabase
        .from('properties')
        .select('name, city, state')
        .eq('id', propertyId)
        .single();

      if (propError || !property) {
        return new Response(
          JSON.stringify({ success: false, status: 'no_property', error: 'Property not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      hotelName = property.name;
      city = `${property.city}, ${property.state}`;

      // Get alias for direct URL if available
      const { data: alias } = await supabase
        .from('hotel_aliases')
        .select('platform_url, resolution_status')
        .eq('property_id', propertyId)
        .eq('source', 'booking')
        .maybeSingle();

      if (alias?.resolution_status === 'not_listed') {
        return new Response(
          JSON.stringify({ success: true, status: 'not_listed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      startUrl = alias?.platform_url || null;
      console.log(`Booking lookup for property ${propertyId}: ${hotelName} in ${city}, URL: ${startUrl || 'none'}`);
    } else if (directHotelName && directCity) {
      // Old interface: direct parameters
      hotelName = directHotelName;
      city = directCity;
      startUrl = directStartUrl || null;
    } else {
      return new Response(
        JSON.stringify({ error: 'propertyId OR (hotelName and city) are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let bestMatch: BookingResult | null = null;

    // If we have a direct URL, try that first
    if (startUrl) {
      console.log(`Using pre-resolved URL for Booking.com: ${startUrl}`);
      bestMatch = await tryDirectUrl(startUrl, apiToken);
    }

    // Fall back to search if no URL or URL fetch failed
    if (!bestMatch) {
      // Parse city and state from input (format: "City, State")
      const [cityName, stateName = ''] = city.split(',').map((s: string) => s.trim());
      
      // Generate search variations using shared utility
      const searchVariations = generateSearchQueries(hotelName, cityName, stateName);
      
      // Try each search variation
      for (const searchQuery of searchVariations) {
        const results = await trySearch(searchQuery, apiToken);
        
        if (results && results.length > 0) {
          bestMatch = findBestMatch(results, hotelName);
          if (bestMatch) {
            console.log(`Found match with query: "${searchQuery}"`);
            break;
          }
        }
        
        // Small delay between searches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!bestMatch) {
      console.log(`No results found for ${hotelName} after trying all methods`);
      
      // Save not_listed status if using propertyId
      if (propertyId) {
        await supabase.from('source_snapshots').insert({
          property_id: propertyId,
          source: 'booking',
          score_raw: null,
          score_scale: 10,
          review_count: 0,
          normalized_score_0_10: null,
          status: 'not_listed',
        });

        // Update alias status
        await supabase
          .from('hotel_aliases')
          .upsert({
            property_id: propertyId,
            source: 'booking',
            resolution_status: 'not_listed',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'property_id,source' });
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          found: false,
          status: 'not_listed',
          message: 'Hotel not listed on Booking.com' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Booking.com final result:`, JSON.stringify(bestMatch, null, 2));

    // Booking.com typically uses 0-10 scale
    const rating = bestMatch.reviewScore || bestMatch.score || bestMatch.rating || null;
    const reviewCount = bestMatch.reviewCount || bestMatch.numberOfReviews || bestMatch.reviews || 0;

    // Save snapshot if using propertyId
    if (propertyId && rating !== null) {
      await supabase.from('source_snapshots').insert({
        property_id: propertyId,
        source: 'booking',
        score_raw: rating,
        score_scale: 10,
        review_count: reviewCount,
        normalized_score_0_10: rating, // Booking uses 0-10 scale
        status: 'found',
      });

      // Update alias with verified status and URL
      await supabase
        .from('hotel_aliases')
        .upsert({
          property_id: propertyId,
          source: 'booking',
          resolution_status: 'verified',
          platform_url: bestMatch.url || startUrl,
          source_name_raw: bestMatch.name,
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'property_id,source' });
    }

    return new Response(
      JSON.stringify({
        success: true,
        found: true,
        status: 'found',
        name: bestMatch.name,
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
      JSON.stringify({ success: false, status: 'error', error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
