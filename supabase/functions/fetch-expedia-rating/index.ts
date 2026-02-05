import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APIFY_BASE_URL = 'https://api.apify.com/v2';
const EXPEDIA_ACTOR_ID = 'pK2iIKVVxERtpwXMy'; // jupri/expedia-hotels

interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
}

interface ExpediaResult {
  name?: string;
  hotelName?: string;
  rating?: number;
  guestRating?: number;
  reviewScore?: number;
  starRating?: number;
  reviewCount?: number;
  numberOfReviews?: number;
  reviews?: number;
  totalReviews?: number;
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

// Generate search query variations
function generateSearchVariations(hotelName: string, city: string, state: string): string[] {
  const variations: string[] = [];
  
  // 1. Full format: Hotel Name, City, State
  variations.push(`${hotelName}, ${city}, ${state}`);
  
  // 2. Standard: Hotel Name + City
  variations.push(`${hotelName} ${city}`);
  
  // 3. Full location without comma
  variations.push(`${hotelName} ${city} ${state}`);
  
  // 4. Hotel name only
  variations.push(hotelName);
  
  // 5. Remove common prefixes/suffixes
  let simplifiedName = hotelName
    .replace(/^The\s+/i, '')
    .replace(/\s+Hotel$/i, '')
    .replace(/\s+Inn$/i, '')
    .replace(/\s+Suites?$/i, '')
    .replace(/\s+Resort$/i, '')
    .trim();
  
  if (simplifiedName !== hotelName) {
    variations.push(`${simplifiedName}, ${city}, ${state}`);
    variations.push(`${simplifiedName} ${city}`);
  }
  
  return [...new Set(variations)]; // Remove duplicates
}

async function trySearch(searchQuery: string, apiToken: string): Promise<ExpediaResult[] | null> {
  console.log(`Expedia trying search: "${searchQuery}"`);
  
  try {
    const runResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${EXPEDIA_ACTOR_ID}/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          maxItems: 3, // Get a few results to find best match
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
    
    console.log(`Apify Expedia run started: ${runId}`);

    const datasetId = await waitForRun(runId, apiToken);
    
    const resultsResponse = await fetch(
      `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
    );
    
    if (!resultsResponse.ok) {
      return null;
    }

    const results: ExpediaResult[] = await resultsResponse.json();
    return results;
  } catch (error) {
    console.error(`Search failed for "${searchQuery}":`, error);
    return null;
  }
}

// Find best matching hotel from results
function findBestMatch(results: ExpediaResult[], hotelName: string): ExpediaResult | null {
  if (!results || results.length === 0) return null;
  
  const normalizedSearch = hotelName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Try exact match first
  for (const result of results) {
    const resultName = result.name || result.hotelName;
    if (resultName) {
      const normalizedResult = resultName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedResult.includes(normalizedSearch) || normalizedSearch.includes(normalizedResult)) {
        return result;
      }
    }
  }
  
  // Return first result if no good match
  return results[0];
}

// Try direct URL scraping
async function tryDirectUrl(startUrl: string, apiToken: string): Promise<ExpediaResult | null> {
  console.log(`Expedia trying direct URL: "${startUrl}"`);
  
  try {
    const runResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${EXPEDIA_ACTOR_ID}/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: startUrl }],
          maxItems: 1,
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
    
    console.log(`Apify Expedia direct URL run started: ${runId}`);

    const datasetId = await waitForRun(runId, apiToken);
    
    const resultsResponse = await fetch(
      `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
    );
    
    if (!resultsResponse.ok) {
      return null;
    }

    const results: ExpediaResult[] = await resultsResponse.json();
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

    const { hotelName, city, startUrl } = await req.json();
    
    if (!hotelName || !city) {
      return new Response(
        JSON.stringify({ error: 'hotelName and city are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let bestMatch: ExpediaResult | null = null;

    // If we have a direct URL, try that first
    if (startUrl) {
      console.log(`Using pre-resolved URL for Expedia: ${startUrl}`);
      bestMatch = await tryDirectUrl(startUrl, apiToken);
    }

    // Fall back to search if no URL or URL fetch failed
    if (!bestMatch) {
      // Parse city and state from input (format: "City, State")
      const [cityName, stateName = ''] = city.split(',').map((s: string) => s.trim());
      
      // Generate search variations
      const searchVariations = generateSearchVariations(hotelName, cityName, stateName);
      
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
      return new Response(
        JSON.stringify({ 
          found: false,
          notListed: true,
          message: 'Hotel not listed on Expedia' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Expedia final result:`, JSON.stringify(bestMatch, null, 2));

    // Expedia can use different scales - detect based on value
    const rawRating = bestMatch.guestRating || bestMatch.reviewScore || bestMatch.rating || null;
    const reviewCount = bestMatch.reviewCount || bestMatch.numberOfReviews || bestMatch.reviews || bestMatch.totalReviews || 0;
    
    // Determine scale: if rating <= 5, assume 5-scale; otherwise 10-scale
    const scale = rawRating !== null && rawRating <= 5 ? 5 : 10;

    return new Response(
      JSON.stringify({
        found: true,
        name: bestMatch.name || bestMatch.hotelName,
        rating: rawRating,
        reviewCount: reviewCount,
        scale: scale,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error fetching Expedia rating:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
