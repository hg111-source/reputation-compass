import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AirbnbListing {
  title: string;
  url: string;
  roomId: string;
  snippet?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query = 'site:airbnb.com "hosted by Kasa"', num = 100 } = await req.json();

    const SERPAPI_KEY = Deno.env.get('SERPAPI_API_KEY');
    if (!SERPAPI_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'SERPAPI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching for Airbnb listings:', query);

    // SerpAPI Google Search
    const searchUrl = new URL('https://serpapi.com/search.json');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('api_key', SERPAPI_KEY);
    searchUrl.searchParams.set('num', String(Math.min(num, 100)));
    searchUrl.searchParams.set('engine', 'google');

    const response = await fetch(searchUrl.toString());
    if (!response.ok) {
      const errorText = await response.text();
      console.error('SerpAPI error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `SerpAPI request failed: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const organicResults = data.organic_results || [];

    console.log(`Found ${organicResults.length} organic results`);

    // Extract Airbnb room listings
    const listings: AirbnbListing[] = [];
    const seenRoomIds = new Set<string>();

    for (const result of organicResults) {
      const url = result.link || '';
      
      // Only keep URLs containing /rooms/ (actual listings)
      if (!url.includes('airbnb.com') || !url.includes('/rooms/')) {
        continue;
      }

      // Extract room ID from URL
      const roomMatch = url.match(/\/rooms\/(\d+)/);
      if (!roomMatch) continue;

      const roomId = roomMatch[1];

      // Skip duplicates
      if (seenRoomIds.has(roomId)) continue;
      seenRoomIds.add(roomId);

      // Extract title - clean up the title
      let title = result.title || '';
      // Remove common Airbnb suffixes
      title = title.replace(/\s*[-–—]\s*Airbnb.*$/i, '').trim();
      title = title.replace(/\s*\|\s*Airbnb.*$/i, '').trim();

      listings.push({
        title,
        url: `https://www.airbnb.com/rooms/${roomId}`,
        roomId,
        snippet: result.snippet || '',
      });
    }

    console.log(`Extracted ${listings.length} unique Airbnb listings`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        listings,
        totalResults: organicResults.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error discovering Airbnb listings:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

