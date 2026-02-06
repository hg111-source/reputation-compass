import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KasaPropertyData {
  name: string;
  url: string;
  slug?: string;
  address: string;
  city: string;
  state: string;
  aggregatedRating: number | null;
  reviewCount: number;
}

interface KasaReview {
  text: string;
  rating: number | null;
  platform: string;
  reviewerName?: string;
  date?: string;
}

// US state abbreviations for parsing addresses
const US_STATES: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia'
};

// Helper function to fetch with retry
async function fetchWithRetry(fetchUrl: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      const response = await fetch(fetchUrl, options);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Fetch attempt ${attempt + 1} failed:`, lastError.message);
    }
  }
  throw lastError || new Error('All retry attempts failed');
}

// Parse rating from markdown content
function parseRating(markdown: string, html: string): { rating: number | null; reviewCount: number } {
  let aggregatedRating: number | null = null;
  let reviewCount = 0;

  // Primary pattern: "4.66• 825 reviews" or "4.66 • 825 reviews"
  const primaryRatingPattern = /(\d+\.\d{1,2})\s*[•·]\s*(\d+)\s*reviews?/i;
  const primaryMatch = markdown.match(primaryRatingPattern) || html.match(primaryRatingPattern);
  
  if (primaryMatch) {
    const rating = parseFloat(primaryMatch[1]);
    if (rating >= 1 && rating <= 5) {
      aggregatedRating = rating;
      reviewCount = parseInt(primaryMatch[2], 10);
      console.log(`Found rating via primary pattern: ${aggregatedRating} (${reviewCount} reviews)`);
    }
  }
  
  // Secondary pattern: "Total rating: 4.66 based on 825 reviews"
  if (!aggregatedRating) {
    const totalRatingPattern = /total\s+rating[:\s]+(\d+\.\d{1,2})\s+based\s+on\s+(\d+)\s*reviews?/i;
    const totalMatch = markdown.match(totalRatingPattern) || html.match(totalRatingPattern);
    if (totalMatch) {
      const rating = parseFloat(totalMatch[1]);
      if (rating >= 1 && rating <= 5) {
        aggregatedRating = rating;
        reviewCount = parseInt(totalMatch[2], 10);
        console.log(`Found rating via total pattern: ${aggregatedRating} (${reviewCount} reviews)`);
      }
    }
  }
  
  // Tertiary: Look for standalone decimal near "review"
  if (!aggregatedRating) {
    const decimalNearReview = /(\d\.\d{2})\s*(?:\n|.){0,50}?(\d+)\s*reviews?/i;
    const decimalMatch = markdown.match(decimalNearReview);
    if (decimalMatch) {
      const rating = parseFloat(decimalMatch[1]);
      if (rating >= 1 && rating <= 5) {
        aggregatedRating = rating;
        reviewCount = parseInt(decimalMatch[2], 10);
        console.log(`Found rating via decimal pattern: ${aggregatedRating} (${reviewCount} reviews)`);
      }
    }
  }

  // If still no review count, try standalone pattern
  if (reviewCount === 0) {
    const reviewCountPatterns = [
      /(\d{1,5})\s*reviews?/i,
      /reviews?\s*\((\d+)\)/i,
    ];
    for (const pattern of reviewCountPatterns) {
      const match = markdown.match(pattern) || html.match(pattern);
      if (match) {
        reviewCount = parseInt(match[1], 10);
        break;
      }
    }
  }

  return { rating: aggregatedRating, reviewCount };
}

// DEFINITIVE slug-to-location mapping from kasa.com/locations (Jan 2025)
// This is the authoritative source - use this first before any parsing
const SLUG_TO_LOCATION: Record<string, { city: string; state: string }> = {
  // Alexandria, VA
  'kasa-alexandria-washington': { city: 'Alexandria', state: 'VA' },
  'kasa-del-ray-alexandria': { city: 'Alexandria', state: 'VA' },
  'the-king-street-house-by-kasa-hotels-alexandria': { city: 'Alexandria', state: 'VA' },
  // Athens, GA
  'the-bell-athens-by-kasa': { city: 'Athens', state: 'GA' },
  // Austin, TX
  'kasa-at-the-waller-apartment-austin': { city: 'Austin', state: 'TX' },
  'studio-haus-east-6th-austin-by-kasa-hotel': { city: 'Austin', state: 'TX' },
  'kasa-downtown-austin': { city: 'Austin', state: 'TX' },
  'kasa-lady-bird-lake-austin': { city: 'Austin', state: 'TX' },
  'kasa-2nd-street-austin': { city: 'Austin', state: 'TX' },
  // Bellevue, WA
  'kasa-bellevue-seattle': { city: 'Bellevue', state: 'WA' },
  // Boise, ID
  'kasa-at-cortland-on-the-river-boise': { city: 'Boise', state: 'ID' },
  // Charlotte, NC
  'kasa-edison-house-charlotte': { city: 'Charlotte', state: 'NC' },
  'kasa-kasa-dilworth-charlotte': { city: 'Charlotte', state: 'NC' },
  'kasa-freemorewest-charlotte': { city: 'Charlotte', state: 'NC' },
  'kasa-at-cortland-noda-charlotte': { city: 'Charlotte', state: 'NC' },
  // Chicago, IL
  'kasa-south-loop-chicago': { city: 'Chicago', state: 'IL' },
  'kasa-river-north-chicago': { city: 'Chicago', state: 'IL' },
  'kasa-magnificent-mile-chicago': { city: 'Chicago', state: 'IL' },
  // Dallas, TX
  'kasa-love-field-medical-district-dallas': { city: 'Dallas', state: 'TX' },
  'mint-house-dallas-downtown-by-kasa': { city: 'Dallas', state: 'TX' },
  // Davie, FL (Fort Lauderdale area)
  'tucker-at-palm-trace-landings-fort-lauderdale': { city: 'Davie', state: 'FL' },
  // Denver, CO
  'kasa-union-station-denver': { city: 'Denver', state: 'CO' },
  'kasa-rino-denver': { city: 'Denver', state: 'CO' },
  // Des Moines, IA
  'kasa-downtown-des-moines': { city: 'Des Moines', state: 'IA' },
  // Detroit, MI
  'kasa-cadillac-square-detroit': { city: 'Detroit', state: 'MI' },
  // Elk Rapids, MI
  'the-dexter-elk-rapids-hotel-by-kasa': { city: 'Elk Rapids', state: 'MI' },
  // Greenville, SC
  'mint-house-greenville-downtown-by-kasa': { city: 'Greenville', state: 'SC' },
  // Hillsboro Beach, FL
  'hillsboro-beach-resort-by-kasa-hotel': { city: 'Hillsboro Beach', state: 'FL' },
  // Hollywood, FL
  'kasa-at-cortland-hollywood-ft-lauderdale': { city: 'Hollywood', state: 'FL' },
  // Long Beach, CA
  'city-center-hotel-by-kasa-long-beach': { city: 'Long Beach', state: 'CA' },
  // Los Angeles, CA
  'stile-downtown-los-angeles-by-kasa': { city: 'Los Angeles', state: 'CA' },
  'kasa-sunset-los-angeles': { city: 'Los Angeles', state: 'CA' },
  // Menlo Park, CA
  'mint-house-menlo-park-by-kasa': { city: 'Menlo Park', state: 'CA' },
  // Miami Beach, FL
  'kasa-collins-park-miami-beach-convention-center': { city: 'Miami Beach', state: 'FL' },
  'kasa-la-flora-miami-beach': { city: 'Miami Beach', state: 'FL' },
  'kasa-impala-miami-beach': { city: 'Miami Beach', state: 'FL' },
  'kasa-el-paseo-miami-beach': { city: 'Miami Beach', state: 'FL' },
  // Miami, FL
  'tucker-at-palmer-dadeland-miami': { city: 'Miami', state: 'FL' },
  'kasa-wynwood-miami': { city: 'Miami', state: 'FL' },
  // Milwaukee, WI
  'kasa-westown-milwaukee': { city: 'Milwaukee', state: 'WI' },
  // Mineral, VA
  'boardwalk-hotel-on-lake-anna-by-kasa': { city: 'Mineral', state: 'VA' },
  // Minneapolis, MN
  'kasa-bryn-mawr-minneapolis': { city: 'Minneapolis', state: 'MN' },
  // Nashville, TN
  'kasa-at-artisan-music-row-nashville': { city: 'Nashville', state: 'TN' },
  'kasa-capitol-hill-downtown-nashville': { city: 'Nashville', state: 'TN' },
  'the-eighteen-by-kasa-nashville': { city: 'Nashville', state: 'TN' },
  'mint-house-nashville-marathon-village-by-kasa': { city: 'Nashville', state: 'TN' },
  // New Orleans, LA
  'the-lafayette-new-orleans-by-kasa': { city: 'New Orleans', state: 'LA' },
  'the-frenchmen-new-orleans-by-kasa': { city: 'New Orleans', state: 'LA' },
  // New York City, NY
  'mint-house-at-70-pine-by-kasa-new-york-city': { city: 'New York', state: 'NY' },
  'kasa-lantern-les': { city: 'New York', state: 'NY' },
  // Philadelphia, PA
  'kasa-the-niche-university-city-philadelphia': { city: 'Philadelphia', state: 'PA' },
  // Pittsburgh, PA
  'kasa-the-maverick-pittsburgh': { city: 'Pittsburgh', state: 'PA' },
  'kasa-south-side-pittsburgh': { city: 'Pittsburgh', state: 'PA' },
  // Portland, OR
  'the-clyde-hotel-portland-by-kasa': { city: 'Portland', state: 'OR' },
  // Raleigh, NC
  'kasa-at-berkshire-village-district-raleigh': { city: 'Raleigh', state: 'NC' },
  // Redwood City, CA
  'kasa-niche-hotel-redwood-city': { city: 'Redwood City', state: 'CA' },
  // Reno, NV
  'kasa-archive-reno-tahoe': { city: 'Reno', state: 'NV' },
  // San Diego, CA
  'kasa-gaslamp-quarter-san-diego': { city: 'San Diego', state: 'CA' },
  'kasa-little-italy-san-diego': { city: 'San Diego', state: 'CA' },
  'the-davis-downtown-san-diego-hotel': { city: 'San Diego', state: 'CA' },
  // San Francisco, CA
  'kasa-la-monarca-san-francisco': { city: 'San Francisco', state: 'CA' },
  'kasa-la-monarca-residential-san-francisco': { city: 'San Francisco', state: 'CA' },
  'kasa-the-hotel-castro-san-francisco': { city: 'San Francisco', state: 'CA' },
  'kasa-the-addison-san-francisco': { city: 'San Francisco', state: 'CA' },
  // Santa Clara, CA
  'kasa-university-airport-santa-clara': { city: 'Santa Clara', state: 'CA' },
  // Savannah, GA
  'kasa-jules-savannah': { city: 'Savannah', state: 'GA' },
  'kasa-altmayer-savannah': { city: 'Savannah', state: 'GA' },
  // Scottsdale, AZ
  'kasa-scottsdale-quarter-phoenix': { city: 'Scottsdale', state: 'AZ' },
  // Skowhegan, ME
  'the-skowhegan-by-kasa': { city: 'Skowhegan', state: 'ME' },
  // St Petersburg, FL
  'mint-house-st-petersburg-downtown-by-kasa': { city: 'St Petersburg', state: 'FL' },
  // Tampa, FL
  'mint-house-tampa-downtown-by-kasa': { city: 'Tampa', state: 'FL' },
  // Traverse City, MI
  'kasa-gold-coast-inn-traverse-city': { city: 'Traverse City', state: 'MI' },
  'kasa-539-bay-street-traverse-city': { city: 'Traverse City', state: 'MI' },
  'the-loop-downtown-traverse-city-apartments-by-kasa': { city: 'Traverse City', state: 'MI' },
  'boardwalk-suites-and-residences-by-kasa-traverse-city': { city: 'Traverse City', state: 'MI' },
  'the-vic-hotel-by-kasa-traverse-city': { city: 'Traverse City', state: 'MI' },
  // Washington, DC
  'mint-house-washington-dc-downtown-by-kasa': { city: 'Washington', state: 'DC' },
  // Wellington, FL
  'kasa-wellington-south-florida': { city: 'Wellington', state: 'FL' },
  // Wilmington, NC
  'kasa-southside-wilmington': { city: 'Wilmington', state: 'NC' },
};

// Parse address from markdown content with multiple fallback strategies
function parseAddress(markdown: string, html: string, slug?: string, propertyName?: string): { address: string; city: string; state: string } {
  let address = '';
  let city = '';
  let state = '';

  // Strategy 0: DEFINITIVE lookup from official Kasa locations page
  if (slug && SLUG_TO_LOCATION[slug]) {
    const loc = SLUG_TO_LOCATION[slug];
    city = loc.city;
    state = loc.state;
    console.log(`Strategy 0 - Definitive slug lookup: ${city}, ${state}`);
    return { address, city, state };
  }

  // Strategy 1: Full address pattern "123 Street Name, City, ST 12345"
  const addressPattern = /(\d+\s+[A-Za-z\s]+(?:Ave|Avenue|St|Street|Blvd|Boulevard|Dr|Drive|Rd|Road|Way|Lane|Ln|Pl|Place|Ct|Court|Circle|Cir|Terrace|Ter|Pkwy|Parkway)[^,]*),\s*([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5})?/gi;
  const addressMatches = [...markdown.matchAll(addressPattern), ...html.matchAll(addressPattern)];
  
  if (addressMatches.length > 0) {
    const match = addressMatches[0];
    address = match[0].trim();
    city = match[2].trim();
    state = match[3].toUpperCase();
    console.log(`Strategy 1 - Full address: ${address}, City: ${city}, State: ${state}`);
  }
  
  // Strategy 2: City, ST ZIP pattern
  if (!city) {
    const cityStateZipPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s+\d{5}/g;
    const cityMatches = [...markdown.matchAll(cityStateZipPattern)];
    if (cityMatches.length > 0) {
      city = cityMatches[0][1].trim();
      state = cityMatches[0][2];
      console.log(`Strategy 2 - City/State/ZIP: ${city}, ${state}`);
    }
  }

  // Strategy 3: Look for "Located in City" or "in City, ST" patterns
  if (!city) {
    const locatedInPattern = /(?:located in|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s*([A-Z]{2})?/i;
    const locatedMatch = markdown.match(locatedInPattern) || html.match(locatedInPattern);
    if (locatedMatch) {
      city = locatedMatch[1].trim();
      state = locatedMatch[2] || '';
      console.log(`Strategy 3 - Located in: ${city}, ${state}`);
    }
  }

  return { address, city, state };
}

// Parse reviews from markdown content
function parseReviews(markdown: string): KasaReview[] {
  const reviews: KasaReview[] = [];
  
  // Look for review blocks - Kasa shows reviews with platform labels
  const reviewSections = markdown.split(/(?=From\s+(?:TripAdvisor|Expedia|Google|Booking|Airbnb))/i);
  
  for (const section of reviewSections) {
    const platformMatch = section.match(/From\s+(TripAdvisor|Expedia|Google|Booking\.com|Booking|Airbnb)/i);
    if (!platformMatch) continue;
    
    const platform = platformMatch[1].toLowerCase().replace('.com', '');
    
    // Extract review text
    const textMatch = section.match(/From\s+\w+[^"]*[""]([^""]+)[""]/i) ||
                      section.match(/From\s+\w+\s*\n+(.+?)(?=\n\n|From\s+\w|$)/is);
    
    if (textMatch) {
      const reviewText = textMatch[1].trim();
      if (reviewText.length > 10) {
        reviews.push({
          text: reviewText,
          rating: null,
          platform: platform === 'booking' ? 'booking' : 
                   platform === 'tripadvisor' ? 'tripadvisor' :
                   platform === 'expedia' ? 'expedia' :
                   platform === 'google' ? 'google' : platform,
        });
      }
    }
  }

  // Also try to parse review blocks with different formatting
  const reviewBlockPattern = /"([^"]{20,500})"\s*[-–—]\s*(?:Guest|Traveler|Visitor)?[^,]*,?\s*(?:From\s+)?(TripAdvisor|Expedia|Google|Booking|Airbnb)/gi;
  let match;
  while ((match = reviewBlockPattern.exec(markdown)) !== null) {
    const existingReview = reviews.find(r => r.text === match[1].trim());
    if (!existingReview) {
      reviews.push({
        text: match[1].trim(),
        rating: null,
        platform: match[2].toLowerCase().replace('.com', ''),
      });
    }
  }

  return reviews;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, slug } = await req.json();
    
    if (!url && !slug) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL or slug is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      throw new Error('FIRECRAWL_API_KEY is not configured');
    }

    const propertyUrl = url || `https://kasa.com/properties/${slug}`;
    console.log(`Scraping Kasa property: ${propertyUrl}`);

    // Scrape the property page with retry logic
    const response = await fetchWithRetry('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: propertyUrl,
        formats: ['markdown', 'html'],
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
    const markdown = data.data?.markdown || data.markdown || '';
    const html = data.data?.html || data.html || '';
    
    console.log('Parsing property data from scraped content...');
    console.log('Markdown preview (first 2000 chars):', markdown.substring(0, 2000));

    // Parse the property name from the page
    let propertyName = '';
    const titleMatch = markdown.match(/^#\s*(.+?)(?:\n|$)/m) || 
                       html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch) {
      propertyName = titleMatch[1].trim();
    }

    // Extract rating and review count
    const { rating: aggregatedRating, reviewCount } = parseRating(markdown, html);
    
    // Extract slug from URL for location parsing
    const urlSlug = slug || propertyUrl.split('/properties/')[1]?.split('?')[0] || '';
    
    // Extract address with all strategies including slug and name
    const { address, city, state } = parseAddress(markdown, html, urlSlug, propertyName);
    
    // Parse reviews
    const reviews = parseReviews(markdown);

    console.log(`Parsed: ${propertyName}, Rating: ${aggregatedRating}, Reviews: ${reviewCount}, City: ${city}, State: ${state}`);

    // Calculate platform breakdown from reviews
    const platformBreakdown: Record<string, number> = {};
    reviews.forEach(r => {
      platformBreakdown[r.platform] = (platformBreakdown[r.platform] || 0) + 1;
    });

    const property: KasaPropertyData = {
      name: propertyName || slug?.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || '',
      url: propertyUrl,
      slug,
      address,
      city,
      state,
      aggregatedRating,
      reviewCount,
    };

    return new Response(
      JSON.stringify({
        success: true,
        property,
        reviews,
        platformBreakdown,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error fetching Kasa property:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
