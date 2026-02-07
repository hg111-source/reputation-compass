import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { normalizeHotelName, analyzeHotelMatch, validateCity } from "../_shared/hotelNameUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
}

// Fetch place details by ID (faster, no search needed)
async function fetchPlaceById(apiKey: string, placeId: string): Promise<PlaceResult | null> {
  console.log(`Fetching place by ID: ${placeId}`);
  
  const detailsUrl = `https://places.googleapis.com/v1/places/${placeId}`;
  
  const response = await fetch(detailsUrl, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,userRatingCount,websiteUri',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Place Details API error: ${response.status} - ${errorText}`);
    return null;
  }

  const data = await response.json();
  console.log(`Place details found: ${data.displayName?.text} - ${data.rating}/5 (${data.userRatingCount} reviews)`);
  
  return {
    id: data.id,
    displayName: data.displayName,
    formattedAddress: data.formattedAddress,
    rating: data.rating,
    userRatingCount: data.userRatingCount,
    websiteUri: data.websiteUri,
  };
}

// Search for place by name (fallback when no placeId)
async function searchPlace(apiKey: string, hotelName: string, city: string): Promise<PlaceResult | null> {
  const normalizedName = normalizeHotelName(hotelName);
  const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
  const query = `${normalizedName} hotel ${city}`;

  console.log(`Searching for: ${hotelName}, ${city}`);
  console.log(`  Normalized query: "${query}"`);

  const searchResponse = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri',
    },
    body: JSON.stringify({
      textQuery: query,
      includedType: 'lodging',
      maxResultCount: 5,
    }),
  });

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    console.error('Google Places API error:', searchResponse.status, errorText);
    throw new Error(`Google Places API error: ${searchResponse.status} - ${errorText}`);
  }

  const searchData = await searchResponse.json();

  if (!searchData.places || searchData.places.length === 0) {
    return null;
  }

  // Find best matching place
  let bestPlace: PlaceResult | null = null;
  const [cityName] = city.split(',').map((s: string) => s.trim());
  
  for (const place of searchData.places as PlaceResult[]) {
    const placeName = place.displayName?.text || '';
    const matchResult = analyzeHotelMatch(hotelName, placeName);
    
    console.log(`Analyzing: "${placeName}" vs "${hotelName}"`);
    console.log(`  → ${matchResult.reason}`);
    console.log(`  → Matching words: [${matchResult.searchWords.filter(w => matchResult.resultWords.includes(w)).join(', ')}]`);
    
    if (matchResult.isMatch) {
      if (validateCity(place.formattedAddress, cityName)) {
        bestPlace = place;
        console.log(`  ✓ Found: ${placeName} (${cityName}) ✓ MATCH`);
        break;
      } else {
        console.log(`  ✗ Found: ${placeName} but CITY MISMATCH (expected ${cityName}) — skipping`);
      }
    }
  }
  
  // Fall back to first result only if it's in the right city
  if (!bestPlace && searchData.places.length > 0) {
    const firstPlace = searchData.places[0] as PlaceResult;
    if (validateCity(firstPlace.formattedAddress, cityName)) {
      bestPlace = firstPlace;
      console.log(`No exact match, using first result: ${bestPlace.displayName?.text}`);
    } else {
      console.log(`First result is in wrong city, rejecting`);
    }
  }

  return bestPlace;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_PLACES_API_KEY is not configured');
    }

    const { hotelName, city, placeId } = await req.json();
    
    if (!hotelName || !city) {
      return new Response(
        JSON.stringify({ error: 'hotelName and city are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let place: PlaceResult | null = null;

    // PRIORITY 1: Use stored placeId if available (faster, more reliable)
    if (placeId) {
      console.log(`Using stored placeId: ${placeId}`);
      place = await fetchPlaceById(apiKey, placeId);
      
      if (!place) {
        console.log(`PlaceId ${placeId} not found, falling back to search`);
      }
    }

    // PRIORITY 2: Search by name if no placeId or placeId lookup failed
    if (!place) {
      console.log(`No placeId or lookup failed, searching by name...`);
      place = await searchPlace(apiKey, hotelName, city);
    }

    if (!place) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          message: 'No matching hotel found in the specified city' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        found: true,
        placeId: place.id,
        name: place.displayName?.text,
        address: place.formattedAddress,
        rating: place.rating ?? null,
        reviewCount: place.userRatingCount ?? 0,
        websiteUrl: place.websiteUri ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error fetching place rating:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
