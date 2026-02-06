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

// Parse address from markdown content
function parseAddress(markdown: string, html: string): { address: string; city: string; state: string } {
  let address = '';
  let city = '';
  let state = '';

  // Pattern: "123 Street Name, City, ST 12345"
  const addressPattern = /(\d+\s+[A-Za-z\s]+(?:Ave|Avenue|St|Street|Blvd|Boulevard|Dr|Drive|Rd|Road|Way|Lane|Ln|Pl|Place|Ct|Court)[^,]*),\s*([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5})?/i;
  const addressMatch = markdown.match(addressPattern) || html.match(addressPattern);
  
  if (addressMatch) {
    address = addressMatch[0].trim();
    city = addressMatch[2].trim();
    state = addressMatch[3].toUpperCase();
    console.log(`Found address: ${address}, City: ${city}, State: ${state}`);
  }
  
  // If no address found, try simpler city/state pattern from content
  if (!city) {
    const cityStatePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\s*\d{5}/;
    const cityStateMatch = markdown.match(cityStatePattern);
    if (cityStateMatch) {
      city = cityStateMatch[1].trim();
      state = cityStateMatch[2];
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
    
    // Extract address
    const { address, city, state } = parseAddress(markdown, html);
    
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
