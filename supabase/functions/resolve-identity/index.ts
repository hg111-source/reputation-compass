import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { analyzeHotelMatch, generateSearchQueries } from "../_shared/hotelNameUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ReviewSource = 'google' | 'tripadvisor' | 'booking' | 'expedia';

interface ResolveRequest {
  propertyId: string;
  hotelName: string;
  city: string;
  state?: string;
  sources: ReviewSource[];
}

interface Candidate {
  name: string;
  url?: string;
  platformId?: string;
  confidence: number;
  reason: string;
}

interface SourceResolution {
  source: ReviewSource;
  status: 'resolved' | 'needs_review' | 'not_listed' | 'scrape_failed' | 'timeout';
  platformId?: string;
  platformUrl?: string;
  platformName?: string;
  confidence?: number;
  candidates?: Candidate[];
  error?: string;
  debug: {
    attempts: number;
    queries: string[];
    duration_ms: number;
  };
}

interface ResolveResponse {
  success: boolean;
  resolutions: SourceResolution[];
  debug: {
    total_duration_ms: number;
    property_id: string;
    hotel_name: string;
  };
}

// ============ GOOGLE RESOLUTION ============
async function resolveGoogle(
  hotelName: string,
  city: string,
  state: string | undefined,
  apiKey: string
): Promise<SourceResolution> {
  const startTime = Date.now();
  const queries: string[] = [];
  let attempts = 0;

  try {
    const searchQueries = generateSearchQueries(hotelName, city, state || '');
    
    for (const query of searchQueries.slice(0, 3)) {
      attempts++;
      queries.push(query);
      
      const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
      searchUrl.searchParams.set('query', query);
      searchUrl.searchParams.set('type', 'lodging');
      searchUrl.searchParams.set('key', apiKey);

      const response = await fetch(searchUrl.toString());
      
      if (!response.ok) {
        if (response.status === 429) {
          return {
            source: 'google',
            status: 'scrape_failed',
            error: 'RATE_LIMITED',
            debug: { attempts, queries, duration_ms: Date.now() - startTime },
          };
        }
        continue;
      }

      const data = await response.json();
      
      if (data.status === 'ZERO_RESULTS') continue;
      if (data.status !== 'OK' || !data.results?.length) continue;

      // Analyze candidates - NO fallback to first result
      const candidates: Candidate[] = [];
      
      for (const result of data.results.slice(0, 5)) {
        const matchResult = analyzeHotelMatch(hotelName, result.name);
        candidates.push({
          name: result.name,
          platformId: result.place_id,
          confidence: matchResult.isMatch ? 0.9 : 0.3,
          reason: matchResult.reason,
        });

        // Only return resolved if confident match
        if (matchResult.isMatch) {
          return {
            source: 'google',
            status: 'resolved',
            platformId: result.place_id,
            platformName: result.name,
            confidence: 0.9,
            debug: { attempts, queries, duration_ms: Date.now() - startTime },
          };
        }
      }

      // No confident match - return needs_review with candidates
      if (candidates.length > 0) {
        return {
          source: 'google',
          status: 'needs_review',
          candidates,
          debug: { attempts, queries, duration_ms: Date.now() - startTime },
        };
      }
    }

    return {
      source: 'google',
      status: 'not_listed',
      debug: { attempts, queries, duration_ms: Date.now() - startTime },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('timeout') || msg.includes('TIMEOUT')) {
      return {
        source: 'google',
        status: 'timeout',
        error: msg,
        debug: { attempts, queries, duration_ms: Date.now() - startTime },
      };
    }
    return {
      source: 'google',
      status: 'scrape_failed',
      error: msg,
      debug: { attempts, queries, duration_ms: Date.now() - startTime },
    };
  }
}

// ============ SERPAPI URL RESOLUTION (for OTAs) ============
async function resolveSerpApi(
  hotelName: string,
  city: string,
  state: string | undefined,
  source: ReviewSource,
  apiKey: string
): Promise<SourceResolution> {
  const startTime = Date.now();
  const queries: string[] = [];
  let attempts = 0;

  const PLATFORM_FILTERS: Record<string, string> = {
    booking: 'site:booking.com/hotel',
    tripadvisor: 'site:tripadvisor.com inurl:Hotel_Review',
    expedia: 'site:expedia.com inurl:Hotel',
  };

  const siteFilter = PLATFORM_FILTERS[source];
  if (!siteFilter) {
    return {
      source,
      status: 'scrape_failed',
      error: 'Unknown platform',
      debug: { attempts: 0, queries: [], duration_ms: 0 },
    };
  }

  try {
    const searchQueries = generateSearchQueries(hotelName, city, state || '');
    
    for (const baseQuery of searchQueries.slice(0, 3)) {
      attempts++;
      const query = `${baseQuery} ${siteFilter}`;
      queries.push(query);

      const url = new URL('https://serpapi.com/search.json');
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('q', query);
      url.searchParams.set('engine', 'google');
      url.searchParams.set('num', '5');

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        if (response.status === 429) {
          return {
            source,
            status: 'scrape_failed',
            error: 'RATE_LIMITED',
            debug: { attempts, queries, duration_ms: Date.now() - startTime },
          };
        }
        continue;
      }

      const data = await response.json();
      
      if (!data.organic_results?.length) continue;

      // Analyze candidates - NO fallback
      const candidates: Candidate[] = [];
      
      for (const result of data.organic_results.slice(0, 5)) {
        const matchResult = analyzeHotelMatch(hotelName, result.title);
        candidates.push({
          name: result.title,
          url: result.link,
          confidence: matchResult.isMatch ? 0.85 : 0.3,
          reason: matchResult.reason,
        });

        if (matchResult.isMatch) {
          return {
            source,
            status: 'resolved',
            platformUrl: result.link,
            platformName: result.title,
            confidence: 0.85,
            debug: { attempts, queries, duration_ms: Date.now() - startTime },
          };
        }
      }

      if (candidates.length > 0) {
        return {
          source,
          status: 'needs_review',
          candidates,
          debug: { attempts, queries, duration_ms: Date.now() - startTime },
        };
      }

      // Small delay between query attempts
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return {
      source,
      status: 'not_listed',
      debug: { attempts, queries, duration_ms: Date.now() - startTime },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('timeout') || msg.includes('TIMEOUT')) {
      return {
        source,
        status: 'timeout',
        error: msg,
        debug: { attempts, queries, duration_ms: Date.now() - startTime },
      };
    }
    return {
      source,
      status: 'scrape_failed',
      error: msg,
      debug: { attempts, queries, duration_ms: Date.now() - startTime },
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const totalStart = Date.now();

  try {
    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    const serpApiKey = Deno.env.get('SERPAPI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { propertyId, hotelName, city, state, sources }: ResolveRequest = await req.json();

    if (!propertyId || !hotelName || !city || !sources?.length) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'propertyId, hotelName, city, and sources are required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`\n========================================`);
    console.log(`Resolving identities for: ${hotelName}, ${city}${state ? `, ${state}` : ''}`);
    console.log(`Property ID: ${propertyId}`);
    console.log(`Sources: ${sources.join(', ')}`);
    console.log(`========================================\n`);

    const resolutions: SourceResolution[] = [];

    for (const source of sources) {
      let resolution: SourceResolution;

      if (source === 'google') {
        if (!googleApiKey) {
          resolution = {
            source: 'google',
            status: 'scrape_failed',
            error: 'GOOGLE_PLACES_API_KEY not configured',
            debug: { attempts: 0, queries: [], duration_ms: 0 },
          };
        } else {
          resolution = await resolveGoogle(hotelName, city, state, googleApiKey);
        }
      } else {
        if (!serpApiKey) {
          resolution = {
            source,
            status: 'scrape_failed',
            error: 'SERPAPI_API_KEY not configured',
            debug: { attempts: 0, queries: [], duration_ms: 0 },
          };
        } else {
          resolution = await resolveSerpApi(hotelName, city, state, source, serpApiKey);
        }
      }

      resolutions.push(resolution);

      // Store resolution in hotel_aliases table
      const aliasData: Record<string, unknown> = {
        property_id: propertyId,
        source,
        resolution_status: resolution.status,
        platform_id: resolution.platformId || null,
        platform_url: resolution.platformUrl || null,
        source_id_or_url: resolution.platformUrl || resolution.platformId || null,
        source_name_raw: resolution.platformName || null,
        confidence_score: resolution.confidence || null,
        candidate_options: resolution.candidates || [],
        last_resolved_at: new Date().toISOString(),
        last_verified_at: resolution.status === 'resolved' ? new Date().toISOString() : null,
        last_error: resolution.error || null,
      };

      const { error: upsertError } = await supabase
        .from('hotel_aliases')
        .upsert(aliasData, { onConflict: 'property_id,source' });

      if (upsertError) {
        console.error(`Error upserting alias for ${source}:`, upsertError);
      }

      // Rate limit between sources
      if (sources.indexOf(source) < sources.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const response: ResolveResponse = {
      success: true,
      resolutions,
      debug: {
        total_duration_ms: Date.now() - totalStart,
        property_id: propertyId,
        hotel_name: hotelName,
      },
    };

    console.log(`\nResolution complete in ${response.debug.total_duration_ms}ms`);
    resolutions.forEach(r => {
      console.log(`  ${r.source}: ${r.status}${r.platformName ? ` (${r.platformName})` : ''}`);
    });

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error resolving identities:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        debug: { total_duration_ms: Date.now() - totalStart }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
