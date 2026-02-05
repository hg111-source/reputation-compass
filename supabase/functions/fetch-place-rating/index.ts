import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PlaceResult {
  place_id?: string;
  rating?: number;
  user_ratings_total?: number;
  name?: string;
  formatted_address?: string;
}

interface PlaceDetails {
  website?: string;
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

    // Use Text Search to find the hotel
    const query = encodeURIComponent(`${hotelName} hotel ${city}`);
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&type=lodging&key=${apiKey}`;

    console.log(`Searching for: ${hotelName} in ${city}`);

    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', searchData.status, searchData.error_message);
      throw new Error(`Google Places API error: ${searchData.status}`);
    }

    if (!searchData.results || searchData.results.length === 0) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          message: 'No matching hotel found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const place: PlaceResult = searchData.results[0];
    let websiteUrl: string | null = null;

    // Fetch Place Details to get the website URL
    if (place.place_id) {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=website&key=${apiKey}`;
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();
        
        if (detailsData.status === 'OK' && detailsData.result?.website) {
          websiteUrl = detailsData.result.website;
          console.log(`Found website: ${websiteUrl}`);
        }
      } catch (detailsError) {
        console.error('Error fetching place details:', detailsError);
        // Continue without website - don't fail the whole request
      }
    }

    return new Response(
      JSON.stringify({
        found: true,
        name: place.name,
        address: place.formatted_address,
        rating: place.rating ?? null,
        reviewCount: place.user_ratings_total ?? 0,
        websiteUrl,
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
