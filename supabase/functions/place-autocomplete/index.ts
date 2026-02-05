import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface AutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface PlaceDetails {
  name: string;
  formatted_address: string;
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
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

    const { input, action, placeId } = await req.json();

    // Action: autocomplete - get suggestions
    if (action === 'autocomplete') {
      if (!input || input.length < 2) {
        return new Response(
          JSON.stringify({ predictions: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const query = encodeURIComponent(input);
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${query}&types=lodging&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Google Places Autocomplete error:', data.status);
        throw new Error(`Google Places API error: ${data.status}`);
      }

      const predictions = (data.predictions || []).map((p: AutocompletePrediction) => ({
        placeId: p.place_id,
        name: p.structured_formatting.main_text,
        description: p.structured_formatting.secondary_text,
        fullDescription: p.description,
      }));

      return new Response(
        JSON.stringify({ predictions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: details - get place details including city/state
    if (action === 'details') {
      if (!placeId) {
        return new Response(
          JSON.stringify({ error: 'placeId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,address_components,website&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        console.error('Google Places Details error:', data.status);
        throw new Error(`Google Places API error: ${data.status}`);
      }

      const result: PlaceDetails = data.result;
      
      // Extract city and state from address components
      let city = '';
      let state = '';
      
      for (const component of result.address_components || []) {
        if (component.types.includes('locality')) {
          city = component.long_name;
        } else if (component.types.includes('sublocality_level_1') && !city) {
          city = component.long_name;
        } else if (component.types.includes('administrative_area_level_1')) {
          state = component.short_name;
        }
      }

      return new Response(
        JSON.stringify({
          name: result.name,
          address: result.formatted_address,
          city,
          state,
          websiteUrl: data.result.website || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "autocomplete" or "details"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in place-autocomplete:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
