import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiscoveredProperty {
  url: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  type: 'hotel' | 'apartment' | 'unknown';
  rating: number | null;
  reviewCount: number | null;
}

// Common US state abbreviations and names
const US_STATES: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'dc': 'DC', 'washington dc': 'DC'
};

// Known cities to help with parsing
const KNOWN_CITIES = [
  'los angeles', 'san francisco', 'san diego', 'new york', 'chicago', 'austin', 'dallas', 'houston',
  'seattle', 'portland', 'denver', 'phoenix', 'las vegas', 'miami', 'atlanta', 'boston', 'nashville',
  'new orleans', 'philadelphia', 'pittsburgh', 'minneapolis', 'salt lake city', 'reno', 'traverse city',
  'santa clara', 'redwood city', 'wilmington', 'raleigh', 'charlotte', 'tampa', 'orlando', 'jacksonville',
  'west loop', 'little italy', 'gaslamp quarter', 'downtown', 'south side', 'gold coast'
];

function parseLocationFromName(name: string): { city: string; state: string } {
  const nameLower = name.toLowerCase();
  let city = '';
  let state = '';

  // Try to find state
  for (const [stateName, abbrev] of Object.entries(US_STATES)) {
    if (nameLower.includes(stateName)) {
      state = abbrev;
      break;
    }
  }

  // Try to find city
  for (const knownCity of KNOWN_CITIES) {
    if (nameLower.includes(knownCity)) {
      city = knownCity.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  // If no city found, try to extract from name pattern
  if (!city) {
    // Pattern: "Kasa [Location] [City]" or "[Name] Hotel [City]"
    const parts = name.replace(/kasa|hotel|apartments?|suites?|residences?|by kasa|living/gi, '')
      .trim()
      .split(/\s+/)
      .filter(p => p.length > 2);
    
    if (parts.length > 0) {
      // Take the last meaningful part as city
      city = parts[parts.length - 1];
      if (parts.length > 1 && parts[parts.length - 2].length > 3) {
        city = parts.slice(-2).join(' ');
      }
    }
  }

  return { city, state };
}

function detectPropertyType(name: string, slug: string): 'hotel' | 'apartment' | 'unknown' {
  const combined = `${name} ${slug}`.toLowerCase();
  
  if (combined.includes('hotel') || combined.includes('inn') || combined.includes('suites')) {
    return 'hotel';
  }
  if (combined.includes('apartment') || combined.includes('residential') || combined.includes('living')) {
    return 'apartment';
  }
  
  return 'unknown';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      throw new Error('FIRECRAWL_API_KEY is not configured');
    }

    console.log('Scraping kasa.com/locations for property list...');

    // Helper function to fetch with retry
    const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          const response = await fetch(url, options);
          return response;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.error(`Fetch attempt ${attempt + 1} failed:`, lastError.message);
        }
      }
      throw lastError || new Error('All retry attempts failed');
    };

    // Scrape the Kasa locations page with retry logic - get markdown too for ratings
    const response = await fetchWithRetry('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://kasa.com/locations',
        formats: ['html', 'links', 'markdown'],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Firecrawl error:', errorText);
      throw new Error(`Firecrawl request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Firecrawl response received');

    // Extract property URLs from the page
    const links: string[] = data.data?.links || data.links || [];
    const markdown: string = data.data?.markdown || data.markdown || '';
    
    // Try to extract ratings from markdown content
    const ratingMap: Record<string, { rating: number; reviewCount: number }> = {};
    
    // Look for patterns like "4.5 (123 reviews)" or "★ 4.5" near property names
    const ratingPatterns = [
      /([A-Za-z\s\-]+?)[\s\n]+(\d+\.?\d*)\s*(?:★|stars?)?\s*\((\d+)\s*reviews?\)/gi,
      /(\d+\.?\d*)\s*(?:★|stars?)?\s*\((\d+)\s*reviews?\)/gi,
    ];
    
    // Filter for property URLs (e.g., /properties/kasa-sunset-los-angeles)
    const propertyUrls = links
      .filter((link: string) => link.includes('/properties/') || link.includes('kasa.com/properties/'))
      .map((link: string) => {
        // Normalize URLs
        if (link.startsWith('/')) {
          return `https://kasa.com${link}`;
        }
        return link;
      })
      .filter((link: string, index: number, arr: string[]) => arr.indexOf(link) === index); // Remove duplicates

    // Extract property slugs and enrich with parsed data
    const properties: DiscoveredProperty[] = propertyUrls.map((url: string) => {
      const match = url.match(/\/properties\/([^/?#]+)/);
      const slug = match ? match[1] : '';
      
      // Convert slug to readable name (kasa-sunset-los-angeles -> Kasa Sunset Los Angeles)
      const name = slug
        .split('-')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Parse location from name
      const { city, state } = parseLocationFromName(name);
      
      // Detect property type
      const type = detectPropertyType(name, slug);
      
      // Check if we found rating data for this property
      const ratingData = ratingMap[slug];
      
      return {
        url,
        slug,
        name,
        city,
        state,
        type,
        rating: ratingData?.rating || null,
        reviewCount: ratingData?.reviewCount || null,
      };
    }).filter((p: DiscoveredProperty) => p.slug);

    console.log(`Found ${properties.length} Kasa properties`);

    return new Response(
      JSON.stringify({
        success: true,
        properties,
        count: properties.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error discovering Kasa properties:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
