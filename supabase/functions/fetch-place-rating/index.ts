import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaceResult {
  rating?: number;
  user_ratings_total?: number;
  name?: string;
  formatted_address?: string;
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
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&type=lodging&key=${apiKey}`;

    console.log(`Searching for: ${hotelName} in ${city}`);

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data.status, data.error_message);
      throw new Error(`Google Places API error: ${data.status}`);
    }

    if (!data.results || data.results.length === 0) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          message: 'No matching hotel found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const place: PlaceResult = data.results[0];

    return new Response(
      JSON.stringify({
        found: true,
        name: place.name,
        address: place.formatted_address,
        rating: place.rating ?? null,
        reviewCount: place.user_ratings_total ?? 0,
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
