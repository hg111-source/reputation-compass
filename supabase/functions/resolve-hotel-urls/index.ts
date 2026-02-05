import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchResult {
  platform: 'booking' | 'tripadvisor' | 'expedia';
  url: string | null;
}

const PLATFORM_SITES: Record<string, string> = {
  booking: 'booking.com',
  tripadvisor: 'tripadvisor.com',
  expedia: 'expedia.com',
};

async function searchSerpApiForUrl(
  apiKey: string,
  hotelName: string,
  city: string,
  platform: string
): Promise<string | null> {
  const site = PLATFORM_SITES[platform];
  const query = `${hotelName} ${city} site:${site}`;
  
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('engine', 'google');
  url.searchParams.set('num', '1');

  console.log(`Searching SerpAPI for: ${query}`);

  try {
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SerpAPI error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    
    // Check organic results
    if (data.organic_results && data.organic_results.length > 0) {
      const resultUrl = data.organic_results[0].link;
      console.log(`Found ${platform} URL: ${resultUrl}`);
      return resultUrl;
    }
    
    console.log(`No ${platform} URL found for ${hotelName}`);
    return null;
  } catch (error) {
    console.error(`Error searching for ${platform}:`, error);
    return null;
  }
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

    const { hotelName, city, platforms = ['booking', 'tripadvisor', 'expedia'] } = await req.json();

    if (!hotelName || !city) {
      return new Response(
        JSON.stringify({ error: 'hotelName and city are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Resolving URLs for: ${hotelName}, ${city}`);
    console.log(`Platforms to search: ${platforms.join(', ')}`);

    const results: Record<string, string | null> = {
      booking_url: null,
      tripadvisor_url: null,
      expedia_url: null,
    };

    const foundPlatforms: string[] = [];
    const notFoundPlatforms: string[] = [];

    // Search for each platform with a 1-second delay between requests
    for (const platform of platforms) {
      const url = await searchSerpApiForUrl(apiKey, hotelName, city, platform);
      
      if (url) {
        results[`${platform}_url`] = url;
        foundPlatforms.push(platform);
      } else {
        notFoundPlatforms.push(platform);
      }

      // 1-second delay between API calls to avoid rate limiting
      if (platforms.indexOf(platform) < platforms.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Results:`, results);

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
