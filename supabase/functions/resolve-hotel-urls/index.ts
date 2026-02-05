import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { normalizeHotelName, analyzeHotelMatch } from "../_shared/hotelNameUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLATFORM_FILTERS: Record<string, string> = {
  booking: 'site:booking.com/hotel',
  tripadvisor: 'site:tripadvisor.com inurl:Hotel_Review',
  // Search Expedia directly to get proper hotel_id from "selected=" parameter
  expedia: 'site:expedia.com inurl:Hotel-Search',
};

// Generate query variations for better matching
function generateQueryVariations(hotelName: string, city: string, state?: string): string[] {
  const normalized = normalizeHotelName(hotelName);
  const queries: string[] = [];
  
  // Primary: normalized name + city
  queries.push(`${normalized} ${city}`);
  
  // With state if provided
  if (state) {
    queries.push(`${normalized} ${city} ${state}`);
  }
  
  // Original name + city (in case brand matters for search)
  queries.push(`${hotelName} ${city}`);
  
  // Simplified: first two significant words + city
  const words = normalized.split(' ').filter(w => w.length > 2);
  if (words.length > 2) {
    queries.push(`${words.slice(0, 2).join(' ')} hotel ${city}`);
  }
  
  return queries;
}

interface SearchResult {
  link: string;
  title: string;
  isMatch: boolean;
  reason: string;
  hotelId?: string; // Hotels.com hotel_id extracted from URL
}

// Extract Expedia hotel_id from URL
function extractExpediaHotelId(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    // Primary: "selected=" parameter (e.g., ?selected=5075)
    const selected = urlObj.searchParams.get('selected');
    if (selected) {
      console.log(`  Extracted hotel_id from selected param: ${selected}`);
      return selected;
    }
    
    // Fallback: "hotelId=" parameter
    const hotelId = urlObj.searchParams.get('hotelId');
    if (hotelId) {
      console.log(`  Extracted hotel_id from hotelId param: ${hotelId}`);
      return hotelId;
    }
  } catch {
    // URL parsing failed, try regex
    const selectedMatch = url.match(/[?&]selected=(\d+)/);
    if (selectedMatch) {
      console.log(`  Extracted hotel_id via regex: ${selectedMatch[1]}`);
      return selectedMatch[1];
    }
  }
  
  console.log(`  Could not extract hotel_id from URL: ${url}`);
  return undefined;
}

interface SearchReturn {
  url: string;
  hotelId?: string;
}

async function searchSerpApiWithValidation(
  apiKey: string,
  hotelName: string,
  city: string,
  state: string | undefined,
  platform: string
): Promise<SearchReturn | null> {
  const siteFilter = PLATFORM_FILTERS[platform];
  const queryVariations = generateQueryVariations(hotelName, city, state);
  
  console.log(`Searching ${platform} for: ${hotelName}, ${city}`);
  console.log(`Query variations: ${queryVariations.join(' | ')}`);
  
  let bestResult: SearchResult | null = null;
  
  for (const baseQuery of queryVariations) {
    const query = `${baseQuery} ${siteFilter}`;
    
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('q', query);
    url.searchParams.set('engine', 'google');
    url.searchParams.set('num', '5');

    console.log(`  Trying query: ${query}`);

    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`  SerpAPI error: ${response.status} - ${errorText}`);
        continue;
      }

      const data = await response.json();
      
      if (data.organic_results && data.organic_results.length > 0) {
        // Use shared matching logic to validate results
        for (const result of data.organic_results.slice(0, 5)) {
          const matchAnalysis = analyzeHotelMatch(hotelName, result.title);
          console.log(`    Result: ${result.title.substring(0, 50)}...`);
          console.log(`      Match: ${matchAnalysis.isMatch} - ${matchAnalysis.reason}`);
          
          if (matchAnalysis.isMatch && !bestResult) {
            const extractedHotelId = platform === 'expedia' ? extractExpediaHotelId(result.link) : undefined;
            bestResult = {
              link: result.link,
              title: result.title,
              isMatch: true,
              reason: matchAnalysis.reason,
              hotelId: extractedHotelId,
            };
            console.log(`  ✓ Match found: ${bestResult.link}`);
            if (extractedHotelId) {
              console.log(`  ✓ Expedia hotel_id: ${extractedHotelId}`);
            }
            break; // First valid match wins
          }
        }
        
        if (bestResult) break; // Stop trying more queries
      }
      
      // Small delay between query attempts
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`  Error with query "${query}":`, error);
    }
  }
  
  if (bestResult) {
    console.log(`  Best ${platform} match: ${bestResult.link} (${bestResult.reason})`);
    return { url: bestResult.link, hotelId: bestResult.hotelId };
  }
  
  console.log(`  No valid ${platform} URL found for ${hotelName}`);
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('SERPAPI_API_KEY');
    
    if (!apiKey) {
      throw new Error('SERPAPI_API_KEY is not configured');
    }
    
    console.log(`SerpAPI Key configured: ${apiKey.substring(0, 8)}...`);

    const { hotelName, city, state, platforms = ['booking', 'tripadvisor', 'expedia'] } = await req.json();

    if (!hotelName || !city) {
      return new Response(
        JSON.stringify({ error: 'hotelName and city are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`\n========================================`);
    console.log(`Resolving URLs for: ${hotelName}, ${city}${state ? `, ${state}` : ''}`);
    console.log(`Platforms: ${platforms.join(', ')}`);
    console.log(`========================================\n`);

    const results: Record<string, string | null> = {
      booking_url: null,
      tripadvisor_url: null,
      expedia_url: null,
    };

    const hotelIds: Record<string, string | null> = {
      expedia_hotel_id: null,
    };

    const foundPlatforms: string[] = [];
    const notFoundPlatforms: string[] = [];

    for (const platform of platforms) {
      const result = await searchSerpApiWithValidation(apiKey, hotelName, city, state, platform);
      
      if (result) {
        results[`${platform}_url`] = result.url;
        foundPlatforms.push(platform);
        
        // Store Hotels.com hotel_id for expedia platform
        if (platform === 'expedia' && result.hotelId) {
          hotelIds.expedia_hotel_id = result.hotelId;
          console.log(`  Hotels.com hotel_id: ${result.hotelId}`);
        }
      } else {
        notFoundPlatforms.push(platform);
      }

      // 1.5-second delay between platforms to avoid rate limiting
      if (platforms.indexOf(platform) < platforms.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    console.log(`\n========================================`);
    console.log(`RESULTS for ${hotelName}:`);
    console.log(`  Found: ${foundPlatforms.join(', ') || 'none'}`);
    console.log(`  Not found: ${notFoundPlatforms.join(', ') || 'none'}`);
    if (hotelIds.expedia_hotel_id) {
      console.log(`  Hotels.com hotel_id: ${hotelIds.expedia_hotel_id}`);
    }
    console.log(`========================================\n`);

    return new Response(
      JSON.stringify({
        success: true,
        urls: results,
        hotelIds,
        found: foundPlatforms,
        notFound: notFoundPlatforms,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error resolving hotel URLs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
