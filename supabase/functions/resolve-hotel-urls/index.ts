import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchResult {
  platform: 'booking' | 'tripadvisor' | 'expedia';
  url: string | null;
}

interface PropertyUrls {
  booking_url: string | null;
  tripadvisor_url: string | null;
  expedia_url: string | null;
}

const PLATFORM_SITES: Record<string, string> = {
  booking: 'booking.com',
  tripadvisor: 'tripadvisor.com',
  expedia: 'expedia.com',
};

async function searchGoogleForUrl(
  apiKey: string,
  cseId: string,
  hotelName: string,
  city: string,
  platform: string
): Promise<string | null> {
  const site = PLATFORM_SITES[platform];
  const query = `${hotelName} ${city} site:${site}`;
  
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cseId);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '1');

  console.log(`Searching Google for: ${query}`);

  try {
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google Search API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const resultUrl = data.items[0].link;
      console.log(`Found ${platform} URL: ${resultUrl}`);
      return resultUrl;
    }
    
    console.log(`No ${platform} URL found for ${hotelName}`);
    return null;
  } catch (error) {
    console.error(`Error searching for ${platform}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    const cseId = Deno.env.get('GOOGLE_CSE_ID');
    
    if (!apiKey) {
      throw new Error('GOOGLE_PLACES_API_KEY is not configured');
    }
    if (!cseId) {
      throw new Error('GOOGLE_CSE_ID is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { propertyId, hotelName, city, platforms = ['booking', 'tripadvisor', 'expedia'] } = await req.json();

    if (!propertyId || !hotelName || !city) {
      return new Response(
        JSON.stringify({ error: 'propertyId, hotelName, and city are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Resolving URLs for: ${hotelName}, ${city}`);
    console.log(`Platforms to search: ${platforms.join(', ')}`);

    const results: PropertyUrls = {
      booking_url: null,
      tripadvisor_url: null,
      expedia_url: null,
    };

    const foundPlatforms: string[] = [];
    const notFoundPlatforms: string[] = [];

    // Search for each platform with a small delay between requests
    for (const platform of platforms) {
      const url = await searchGoogleForUrl(apiKey, cseId, hotelName, city, platform);
      
      if (url) {
        results[`${platform}_url` as keyof PropertyUrls] = url;
        foundPlatforms.push(platform);
      } else {
        notFoundPlatforms.push(platform);
      }

      // Small delay between Google API calls to avoid rate limiting
      if (platforms.indexOf(platform) < platforms.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Update the property with found URLs
    const updateData: Partial<PropertyUrls> = {};
    for (const platform of platforms) {
      const key = `${platform}_url` as keyof PropertyUrls;
      updateData[key] = results[key];
    }

    const { error: updateError } = await supabase
      .from('properties')
      .update(updateData)
      .eq('id', propertyId);

    if (updateError) {
      console.error('Failed to update property URLs:', updateError);
      throw new Error(`Failed to update property: ${updateError.message}`);
    }

    console.log(`Updated property ${propertyId} with URLs:`, updateData);

    return new Response(
      JSON.stringify({
        success: true,
        urls: results,
        found: foundPlatforms,
        notFound: notFoundPlatforms,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error resolving hotel URLs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
