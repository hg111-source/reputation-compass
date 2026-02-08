import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RAPIDAPI_HOTELS_HOST = 'hotels-com-provider.p.rapidapi.com';
const RAPIDAPI_BOOKING_HOST = 'booking-com.p.rapidapi.com';

// ─── Google Reviews via Places API (New) ───────────────────────────
async function fetchGoogleReviews(
  googleApiKey: string,
  placeId: string,
): Promise<{ reviews: any[]; hotelName: string }> {
  console.log(`Fetching Google reviews for place_id: ${placeId}`);

  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': googleApiKey,
      'X-Goog-FieldMask': 'displayName,reviews',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Google Places API error: ${response.status} - ${errorText}`);
    throw new Error(`Google Places API failed: ${response.status}`);
  }

  const data = await response.json();
  const hotelName = data.displayName?.text || '';

  const reviews = (data.reviews || []).map((r: any) => ({
    text: r.text?.text || '',
    rating: r.rating || null,
    date: null, // Google returns relative dates like "a month ago" which aren't valid timestamps
    reviewer: r.authorAttribution?.displayName || null,
  })).filter((r: any) => r.text.length > 10);

  console.log(`Parsed ${reviews.length} Google reviews for ${placeId}`);
  return { reviews, hotelName };
}

// ─── Expedia Reviews via RapidAPI Hotels.com Provider ──────────────
async function fetchExpediaReviews(
  rapidApiKey: string,
  hotelId: string,
  maxReviews: number,
): Promise<{ reviews: any[]; hotelName: string }> {
  console.log(`Fetching Expedia reviews for hotel_id: ${hotelId}`);

  const reviews: any[] = [];
  let page = 1;
  const maxPages = Math.ceil(maxReviews / 10); // ~10 reviews per page

  while (reviews.length < maxReviews && page <= maxPages) {
    const url = `https://${RAPIDAPI_HOTELS_HOST}/v2/hotels/reviews/list?hotel_id=${hotelId}&locale=en_US&domain=US&page_number=${page}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOTELS_HOST,
        'x-rapidapi-key': rapidApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Expedia reviews API error: ${response.status} - ${errorText}`);
      if (page === 1) throw new Error(`Expedia reviews API failed: ${response.status}`);
      break; // Partial results are fine
    }

    const data = await response.json();
    const reviewItems = data.reviewInfo?.reviews || [];

    if (reviewItems.length === 0) break;

    for (const r of reviewItems) {
      const text = r.text || '';
      const title = r.title || '';
      const fullText = title && title.length > 0 ? `${title}. ${text}` : text;

      let rating: number | null = null;
      const ratingStr = r.reviewScoreWithDescription?.value;
      if (ratingStr) {
        const match = String(ratingStr).replace(',', '.').match(/([\d.]+)/);
        if (match) rating = parseFloat(match[1]);
      }

      const reviewer = r.reviewFooter?.messages?.[0]?.text?.text || null;

      if (fullText.length > 10) {
        reviews.push({ text: fullText, rating, date: r.submissionTimeLocalized || null, reviewer });
      }
      if (reviews.length >= maxReviews) break;
    }

    page++;
    // Small delay between pages
    if (page <= maxPages && reviews.length < maxReviews) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  console.log(`Parsed ${reviews.length} Expedia reviews for hotel_id ${hotelId}`);
  return { reviews, hotelName: '' };
}

// ─── Booking.com Reviews via RapidAPI ──────────────────────────────
async function fetchBookingReviews(
  rapidApiKey: string,
  bookingUrl: string,
  maxReviews: number,
): Promise<{ reviews: any[]; hotelName: string }> {
  // Extract hotel_id from Booking URL
  // Try common patterns: /hotel/us/hotel-name.html -> search by URL
  // The RapidAPI booking-com endpoint needs a numeric hotel_id
  // We'll use the reviews endpoint with the hotel slug

  console.log(`Fetching Booking reviews for URL: ${bookingUrl}`);

  // First, try to search for the hotel to get the numeric ID
  const searchUrl = `https://${RAPIDAPI_BOOKING_HOST}/v1/hotels/reviews?hotel_id=0&locale=en-us&sort_type=SORT_MOST_RELEVANT&language_filter=en-us&customer_type=solo_traveller,couple,family_with_children,review_category_group_of_friends`;

  // We need a numeric hotel_id - try extracting from URL or use search
  // Booking URLs: booking.com/hotel/us/hotel-name.html
  // Alternative: use the data-hotel-id from the page
  
  // For now, try to get hotel_id via the search endpoint
  const slugMatch = bookingUrl.match(/\/hotel\/[a-z]{2}\/([^./?]+)/);
  const hotelSlug = slugMatch ? slugMatch[1] : null;

  if (!hotelSlug) {
    console.log('Could not extract hotel slug from Booking URL');
    return { reviews: [], hotelName: '' };
  }

  // Use the search endpoint to find the hotel_id
  const destUrl = `https://${RAPIDAPI_BOOKING_HOST}/v1/hotels/search-by-coordinates?locale=en-us&room_number=1&checkin_date=2026-03-01&checkout_date=2026-03-02&adults_number=1&filter_by_currency=USD&order_by=popularity&units=metric&longitude=0&latitude=0&page_number=0`;

  // Alternative: try direct reviews with hotel name as search
  // Let's try the reviews/list endpoint which may accept names
  
  // Actually, let's try fetching by URL - some RapidAPI Booking providers support this
  // For now, skip if we can't resolve the ID
  console.log(`Booking hotel slug: ${hotelSlug} - numeric ID resolution needed`);
  
  // Try the v1/hotels/reviews endpoint - it requires a numeric hotel_id
  // We don't have one, so return empty for now
  // TODO: Add Booking hotel_id resolution
  return { reviews: [], hotelName: '' };
}

// ─── Retry helper ──────────────────────────────────────────────────
async function retryOperation<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  label: string = 'operation'
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`${label} attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastError.message}`);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY') || '';
    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY') || '';

    const { 
      propertyId, 
      hotelName, 
      city, 
      platform = 'all', 
      maxReviews = 25 
    } = await req.json();
    
    if (!propertyId || !hotelName || !city) {
      return new Response(
        JSON.stringify({ error: 'propertyId, hotelName, and city are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching ${platform} review text for: ${hotelName}, ${city}`);

    // Get property details for platform IDs
    const { data: property } = await supabase
      .from('properties')
      .select('google_place_id, booking_url')
      .eq('id', propertyId)
      .maybeSingle();

    // Get hotel aliases for Expedia
    const { data: aliases } = await supabase
      .from('hotel_aliases')
      .select('source, platform_id, platform_url, resolution_status')
      .eq('property_id', propertyId)
      .in('source', ['expedia', 'booking']);

    const expediaAlias = aliases?.find(a => a.source === 'expedia' && a.resolution_status !== 'not_listed');
    const bookingAlias = aliases?.find(a => a.source === 'booking' && a.resolution_status !== 'not_listed');

    const platformsToFetch = platform === 'all' 
      ? ['google', 'expedia'] 
      : [platform];

    const results: { platform: string; reviews: any[]; hotelName: string }[] = [];
    const errors: { platform: string; error: string }[] = [];

    // Fetch all platforms in parallel for speed
    const fetchPromises: Promise<void>[] = [];

    for (const p of platformsToFetch) {
      const promise = (async () => {
        try {
          console.log(`Fetching review text from ${p}...`);

          if (p === 'google') {
            const placeId = property?.google_place_id;
            if (!placeId) {
              console.log('No google_place_id, skipping Google reviews');
              errors.push({ platform: 'google', error: 'No Google Place ID' });
              return;
            }
            if (!googleApiKey) {
              errors.push({ platform: 'google', error: 'GOOGLE_PLACES_API_KEY not configured' });
              return;
            }
            const result = await fetchGoogleReviews(googleApiKey, placeId);
            results.push({ platform: 'google', ...result });

          } else if (p === 'expedia') {
            const hotelId = expediaAlias?.platform_id;
            if (!hotelId) {
              console.log('No Expedia hotel_id, skipping Expedia reviews');
              errors.push({ platform: 'expedia', error: 'No Expedia hotel ID' });
              return;
            }
            if (!rapidApiKey) {
              errors.push({ platform: 'expedia', error: 'RAPIDAPI_KEY not configured' });
              return;
            }
            const result = await fetchExpediaReviews(rapidApiKey, hotelId, maxReviews);
            results.push({ platform: 'expedia', ...result });

          } else if (p === 'booking') {
            const bookingUrl = bookingAlias?.platform_url || property?.booking_url;
            if (!bookingUrl) {
              errors.push({ platform: 'booking', error: 'No Booking URL' });
              return;
            }
            if (!rapidApiKey) {
              errors.push({ platform: 'booking', error: 'RAPIDAPI_KEY not configured' });
              return;
            }
            const result = await fetchBookingReviews(rapidApiKey, bookingUrl, maxReviews);
            results.push({ platform: 'booking', ...result });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Error fetching review text from ${p}:`, msg);
          errors.push({ platform: p, error: msg });
        }
      })();
      fetchPromises.push(promise);
    }

    // Run all fetches in parallel
    await Promise.all(fetchPromises);

    let totalReviews = 0;
    const saveErrors: { platform: string; error: string }[] = [];

    // Store reviews for each platform
    for (const result of results) {
      if (result.reviews.length === 0) continue;

      const reviewsToInsert = result.reviews
        .filter((r: { text?: string }) => r.text && r.text.length > 10)
        .map((r: { text?: string; rating?: number; date?: string; reviewer?: string }) => {
          // Safely parse date - only use if it's a valid date format
          let reviewDate: string | null = null;
          if (r.date) {
            const parsed = new Date(r.date);
            if (!isNaN(parsed.getTime())) {
              reviewDate = parsed.toISOString();
            }
          }
          return {
            property_id: propertyId,
            platform: result.platform,
            review_text: r.text || '',
            review_rating: r.rating || null,
            review_date: reviewDate,
            reviewer_name: r.reviewer || null,
          };
        });

      if (reviewsToInsert.length === 0) continue;

      try {
        await retryOperation(async () => {
          // Delete old reviews for this platform
          const { error: deleteError } = await supabase
            .from('review_texts')
            .delete()
            .eq('property_id', propertyId)
            .eq('platform', result.platform);

          if (deleteError) throw new Error(`Delete failed: ${deleteError.message}`);

          // Insert new reviews
          const { error: insertError } = await supabase
            .from('review_texts')
            .insert(reviewsToInsert);

          if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

          // Verify save
          const { count, error: countError } = await supabase
            .from('review_texts')
            .select('*', { count: 'exact', head: true })
            .eq('property_id', propertyId)
            .eq('platform', result.platform);

          if (countError) throw new Error(`Verification query failed: ${countError.message}`);

          console.log(`✅ Verified ${count} ${result.platform} reviews saved for ${propertyId}`);
        }, 2, `save-${result.platform}-reviews`);

        totalReviews += reviewsToInsert.length;
      } catch (saveErr) {
        const msg = saveErr instanceof Error ? saveErr.message : String(saveErr);
        console.error(`❌ Failed to save ${result.platform} reviews:`, msg);
        saveErrors.push({ platform: result.platform, error: msg });
      }
    }

    return new Response(
      JSON.stringify({
        success: saveErrors.length === 0 && errors.length === 0,
        reviewCount: totalReviews,
        platforms: results.map(r => ({ platform: r.platform, count: r.reviews.length })),
        fetchErrors: errors.length > 0 ? errors : undefined,
        saveErrors: saveErrors.length > 0 ? saveErrors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error fetching reviews:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
