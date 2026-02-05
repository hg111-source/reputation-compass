import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { analyzeHotelMatch, generateSearchQueries } from "../_shared/hotelNameUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APIFY_BASE_URL = 'https://api.apify.com/v2';
const EXPEDIA_SEARCH_ACTOR_ID = 'pK2iIKVVxERtpwXMy'; // jupri/expedia-hotels (search-based)
const CHEERIO_SCRAPER_ID = 'YvFnfxvCbCLumMHJL'; // apify/cheerio-scraper (fast page scraper)

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
  // Fields from tri_angle actor
  hotelOverallRating?: number;
  hotelReviewCount?: number;
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

async function trySearch(searchQuery: string, apiToken: string): Promise<ExpediaResult[] | null> {
  console.log(`Expedia trying search: "${searchQuery}"`);
  
  try {
    const runResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${EXPEDIA_SEARCH_ACTOR_ID}/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          maxItems: 5, // Get a few results to find best match
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

// Find best matching hotel from results using word-based matching with logging
function findBestMatch(results: ExpediaResult[], hotelName: string): ExpediaResult | null {
  if (!results || results.length === 0) return null;
  
  // Use the word-based hotel name matching with detailed analysis
  for (const result of results) {
    const resultName = result.name || result.hotelName;
    if (resultName) {
      const matchResult = analyzeHotelMatch(hotelName, resultName);
      console.log(`Analyzing: "${resultName}" vs "${hotelName}"`);
      console.log(`  → ${matchResult.reason}`);
      
      if (matchResult.isMatch) {
        console.log(`  ✓ MATCH`);
        return result;
      }
    }
  }
  
  // Return first result if no good match
  const firstName = results[0].name || results[0].hotelName;
  console.log(`No exact match, using first result: ${firstName}`);
  return results[0];
}

// Try direct URL scraping using lightweight Cheerio Scraper (fast!)
async function tryDirectUrl(startUrl: string, apiToken: string): Promise<ExpediaResult | null> {
  console.log(`Expedia trying direct URL with Cheerio Scraper: "${startUrl}"`);
  
  try {
    // Use Cheerio Scraper - much faster than reviews scrapers
    // The pageFunction extracts rating data from the page HTML
    const pageFunction = `
      async function pageFunction(context) {
        const { $, request } = context;
        
        // Try to find rating in various places Expedia uses
        // Method 1: Look for guest rating in structured data
        let rating = null;
        let reviewCount = null;
        let hotelName = null;
        
        // Try JSON-LD structured data first
        const jsonLdScripts = $('script[type="application/ld+json"]');
        jsonLdScripts.each((i, el) => {
          try {
            const data = JSON.parse($(el).html());
            if (data['@type'] === 'Hotel' || data['@type'] === 'LodgingBusiness') {
              if (data.aggregateRating) {
                rating = parseFloat(data.aggregateRating.ratingValue);
                reviewCount = parseInt(data.aggregateRating.reviewCount) || 0;
              }
              hotelName = data.name;
            }
          } catch (e) {}
        });
        
        // Method 2: Look for rating in common Expedia elements
        if (!rating) {
          // Guest rating badge (e.g., "8.4/10")
          const ratingText = $('[data-stid="reviews-summary"] span, .uitk-badge, [class*="rating"]').first().text();
          const match = ratingText.match(/(\\d+\\.?\\d*)\\s*\\/\\s*10/);
          if (match) {
            rating = parseFloat(match[1]);
          }
        }
        
        // Method 3: Look for review count
        if (!reviewCount) {
          const reviewText = $('[data-stid="reviews-summary"], [class*="review"]').text();
          const countMatch = reviewText.match(/(\\d[\\d,]*)\\s*(?:reviews?|ratings?)/i);
          if (countMatch) {
            reviewCount = parseInt(countMatch[1].replace(/,/g, ''));
          }
        }
        
        // Get hotel name if not found
        if (!hotelName) {
          hotelName = $('h1').first().text().trim() || $('[data-stid="content-hotel-title"]').text().trim();
        }
        
        return {
          url: request.url,
          hotelName,
          rating,
          reviewCount: reviewCount || 0,
        };
      }
    `;
    
    const runResponse = await fetch(
      `${APIFY_BASE_URL}/acts/${CHEERIO_SCRAPER_ID}/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: startUrl }],
          pageFunction,
          maxRequestsPerCrawl: 1,
          maxConcurrency: 1,
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
    
    console.log(`Apify Cheerio Scraper run started: ${runId}`);

    // Cheerio scraper is fast - reduce timeout to 60 seconds
    const datasetId = await waitForRun(runId, apiToken, 60000);
    
    const resultsResponse = await fetch(
      `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiToken}`
    );
    
    if (!resultsResponse.ok) {
      return null;
    }

    const results = await resultsResponse.json();
    console.log(`Cheerio Scraper results:`, JSON.stringify(results, null, 2));
    
    if (results && results.length > 0) {
      const result = results[0];
      return {
        name: result.hotelName,
        hotelName: result.hotelName,
        hotelOverallRating: result.rating,
        hotelReviewCount: result.reviewCount,
      };
    }
    return null;
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
    // tri_angle actor uses hotelOverallRating (0-10 scale)
    const rawRating = bestMatch.hotelOverallRating || bestMatch.guestRating || bestMatch.reviewScore || bestMatch.rating || null;
    const reviewCount = bestMatch.hotelReviewCount || bestMatch.reviewCount || bestMatch.numberOfReviews || bestMatch.reviews || bestMatch.totalReviews || 0;
    
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
