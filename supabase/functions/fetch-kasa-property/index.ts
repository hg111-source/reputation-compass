import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KasaReview {
  text: string;
  rating: number | null;
  platform: string;
  reviewerName?: string;
  date?: string;
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

    // Helper function to fetch with retry
    const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            // Exponential backoff: 1s, 2s, 4s
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

    // Parse the property name from the page
    let propertyName = '';
    const titleMatch = markdown.match(/^#\s*(.+?)(?:\n|$)/m) || 
                       html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch) {
      propertyName = titleMatch[1].trim();
    }

    // Extract rating - look for patterns like "4.62" near "rating" or "reviews"
    let aggregatedRating: number | null = null;
    const ratingPatterns = [
      /(\d+\.?\d*)\s*(?:out of 5|\/5|stars?)/i,
      /rating[:\s]*(\d+\.?\d*)/i,
      /(\d+\.\d{1,2})\s*\(\d+\s*reviews?\)/i,
      /★\s*(\d+\.?\d*)/,
      /(\d+\.\d{2})\s*(?:·|•|\|)/,
    ];
    
    for (const pattern of ratingPatterns) {
      const match = markdown.match(pattern) || html.match(pattern);
      if (match) {
        const rating = parseFloat(match[1]);
        if (rating >= 0 && rating <= 5) {
          aggregatedRating = rating;
          break;
        }
      }
    }

    // Extract review count
    let reviewCount = 0;
    const reviewCountPatterns = [
      /(\d+)\s*reviews?/i,
      /reviews?\s*\((\d+)\)/i,
      /\((\d+)\s*reviews?\)/i,
    ];
    
    for (const pattern of reviewCountPatterns) {
      const match = markdown.match(pattern) || html.match(pattern);
      if (match) {
        reviewCount = parseInt(match[1], 10);
        break;
      }
    }

    // Extract location information
    let city = '';
    let state = '';
    
    // Try to extract from property name or URL
    const locationMatch = propertyName.match(/(?:kasa\s+)?(.+?)\s*$/i);
    if (locationMatch) {
      const locationPart = locationMatch[1];
      // Common patterns like "Sunset Los Angeles" or "West Loop Chicago"
      const cityStateMatch = locationPart.match(/(.+?)\s+([\w\s]+)$/);
      if (cityStateMatch) {
        city = cityStateMatch[2].trim();
      } else {
        city = locationPart.trim();
      }
    }
    
    // Try to find address in content
    const addressMatch = markdown.match(/(?:address|location)[:\s]*([^,\n]+),?\s*([A-Z]{2})?/i) ||
                         html.match(/(?:address|location)[:\s]*([^,<]+),?\s*([A-Z]{2})?/i);
    if (addressMatch) {
      if (addressMatch[1]) city = addressMatch[1].trim();
      if (addressMatch[2]) state = addressMatch[2].trim();
    }

    // Parse reviews from the page
    const reviews: KasaReview[] = [];
    
    // Look for review blocks - Kasa shows reviews with platform labels
    // Pattern: "From TripAdvisor" or "From Expedia" followed by review text
    const reviewSections = markdown.split(/(?=From\s+(?:TripAdvisor|Expedia|Google|Booking|Airbnb))/i);
    
    for (const section of reviewSections) {
      const platformMatch = section.match(/From\s+(TripAdvisor|Expedia|Google|Booking\.com|Booking|Airbnb)/i);
      if (!platformMatch) continue;
      
      const platform = platformMatch[1].toLowerCase().replace('.com', '');
      
      // Extract review text - everything between platform label and next section or end
      const textMatch = section.match(/From\s+\w+[^"]*[""]([^""]+)[""]/i) ||
                        section.match(/From\s+\w+\s*\n+(.+?)(?=\n\n|From\s+\w|$)/is);
      
      if (textMatch) {
        const reviewText = textMatch[1].trim();
        if (reviewText.length > 10) {
          reviews.push({
            text: reviewText,
            rating: null, // Individual ratings not always shown
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

    console.log(`Parsed: ${propertyName}, Rating: ${aggregatedRating}, Reviews: ${reviewCount}, Extracted ${reviews.length} review texts`);

    // Calculate platform breakdown from reviews
    const platformBreakdown: Record<string, number> = {};
    reviews.forEach(r => {
      platformBreakdown[r.platform] = (platformBreakdown[r.platform] || 0) + 1;
    });

    return new Response(
      JSON.stringify({
        success: true,
        property: {
          name: propertyName || slug?.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          url: propertyUrl,
          slug,
          city,
          state,
          aggregatedRating,
          reviewCount,
          reviews,
          platformBreakdown,
        },
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
