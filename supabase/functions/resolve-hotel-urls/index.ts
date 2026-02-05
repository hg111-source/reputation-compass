import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLATFORM_FILTERS: Record<string, string> = {
  booking: 'site:booking.com/hotel',
  tripadvisor: 'site:tripadvisor.com inurl:Hotel_Review',
  expedia: 'site:expedia.com inurl:Hotel',
};

// Normalize text for comparison (lowercase, remove special chars)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Simplify hotel name (remove common suffixes like "Hotel", "Resort", etc.)
function simplifyHotelName(name: string): string {
  return name
    .replace(/\b(hotel|resort|inn|suites?|lodge|motel|b&b|bed\s*&?\s*breakfast)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate match score between hotel name and URL/title
function calculateMatchScore(hotelName: string, url: string, title: string): number {
  const normalizedHotel = normalizeText(hotelName);
  const normalizedTitle = normalizeText(title);
  const normalizedUrl = normalizeText(url);
  
  const hotelWords = normalizedHotel.split(' ').filter(w => w.length > 2);
  
  let score = 0;
  
  // Check how many hotel name words appear in the title
  for (const word of hotelWords) {
    if (normalizedTitle.includes(word)) {
      score += 2;
    }
    if (normalizedUrl.includes(word)) {
      score += 1;
    }
  }
  
  // Bonus for exact phrase match
  if (normalizedTitle.includes(normalizedHotel)) {
    score += 10;
  }
  
  // Bonus for simplified name match
  const simplifiedHotel = normalizeText(simplifyHotelName(hotelName));
  if (simplifiedHotel && normalizedTitle.includes(simplifiedHotel)) {
    score += 5;
  }
  
  return score;
}

// Generate query variations for better matching
function generateQueryVariations(hotelName: string, city: string, state?: string): string[] {
  const queries: string[] = [];
  
  // Primary: Full name + city
  queries.push(`${hotelName} ${city}`);
  
  // Secondary: Full name + state (if provided)
  if (state) {
    queries.push(`${hotelName} ${state}`);
  }
  
  // Tertiary: Simplified name + city
  const simplified = simplifyHotelName(hotelName);
  if (simplified !== hotelName && simplified.length > 3) {
    queries.push(`${simplified} ${city}`);
  }
  
  // Quaternary: Just the hotel name (for unique names)
  if (hotelName.split(' ').length >= 3) {
    queries.push(hotelName);
  }
  
  return queries;
}

interface SearchResult {
  link: string;
  title: string;
  score: number;
}

async function searchSerpApiWithValidation(
  apiKey: string,
  hotelName: string,
  city: string,
  state: string | undefined,
  platform: string
): Promise<string | null> {
  const siteFilter = PLATFORM_FILTERS[platform];
  const queryVariations = generateQueryVariations(hotelName, city, state);
  
  console.log(`Searching ${platform} for: ${hotelName}, ${city}`);
  console.log(`Query variations: ${queryVariations.join(' | ')}`);
  
  let bestResult: SearchResult | null = null;
  const minScoreThreshold = 3; // Minimum score to consider a valid match
  
  for (const baseQuery of queryVariations) {
    const query = `${baseQuery} ${siteFilter}`;
    
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('q', query);
    url.searchParams.set('engine', 'google');
    url.searchParams.set('num', '5'); // Get top 5 results

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
        // Score all results and find the best match
        for (const result of data.organic_results.slice(0, 5)) {
          const score = calculateMatchScore(hotelName, result.link, result.title);
          console.log(`    Result: ${result.title.substring(0, 50)}... (score: ${score})`);
          
          if (score >= minScoreThreshold && (!bestResult || score > bestResult.score)) {
            bestResult = {
              link: result.link,
              title: result.title,
              score: score,
            };
          }
        }
        
        // If we found a high-confidence match, stop trying more queries
        if (bestResult && bestResult.score >= 8) {
          console.log(`  High-confidence match found: ${bestResult.link} (score: ${bestResult.score})`);
          break;
        }
      }
      
      // Small delay between query attempts
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`  Error with query "${query}":`, error);
    }
  }
  
  if (bestResult) {
    console.log(`  Best ${platform} match: ${bestResult.link} (score: ${bestResult.score})`);
    return bestResult.link;
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

    const foundPlatforms: string[] = [];
    const notFoundPlatforms: string[] = [];

    for (const platform of platforms) {
      const url = await searchSerpApiWithValidation(apiKey, hotelName, city, state, platform);
      
      if (url) {
        results[`${platform}_url`] = url;
        foundPlatforms.push(platform);
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
    console.log(`========================================\n`);

    return new Response(
      JSON.stringify({
        success: true,
        urls: results,
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
