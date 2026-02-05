import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_PLACES_API_KEY is not configured');
    }

    const { hotelName, city } = await req.json();
    
    if (!hotelName || !city) {
      return new Response(
        JSON.stringify({ error: 'hotelName and city are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the new Places API (Text Search)
    const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
    const query = `${hotelName} hotel ${city}`;

    console.log(`Searching for: ${hotelName} in ${city}`);

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
        maxResultCount: 1,
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Google Places API error:', searchResponse.status, errorText);
      throw new Error(`Google Places API error: ${searchResponse.status} - ${errorText}`);
    }

    const searchData = await searchResponse.json();

    if (!searchData.places || searchData.places.length === 0) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          message: 'No matching hotel found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const place: PlaceResult = searchData.places[0];

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
