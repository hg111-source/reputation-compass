import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/lib/types';
import { ReviewSource, HotelAlias } from './useHotelAliases';

export type RatingStatus = 'found' | 'not_listed' | 'scrape_failed' | 'timeout' | 'no_alias' | 'needs_review';

export interface FetchRatingResult {
  success: boolean;
  status: RatingStatus;
  rating?: number | null;
  reviewCount?: number;
  scale?: number;
  platformName?: string;
  error?: string;
  debug: {
    duration_ms: number;
    used_alias: boolean;
    alias_status?: string;
    apify_run_id?: string;
  };
}

interface FetchRatingParams {
  propertyId: string;
  source: ReviewSource;
}

interface RefreshPropertyRatingsParams {
  property: Property;
  sources?: ReviewSource[];
}

interface RefreshResult {
  source: ReviewSource;
  result: FetchRatingResult;
}

/**
 * Fetch rating using a pre-resolved alias (stable identifier).
 * This is the PRIMARY way to refresh ratings - it uses stored IDs/URLs
 * and does NOT re-search.
 */
export function useFetchRatingByAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, source }: FetchRatingParams): Promise<FetchRatingResult> => {
      const { data, error } = await supabase.functions.invoke('fetch-rating-by-alias', {
        body: { propertyId, source },
      });

      if (error) {
        if (error.message?.includes('rate limit') || error.message?.includes('429')) {
          return {
            success: false,
            status: 'scrape_failed',
            error: 'RATE_LIMITED',
            debug: { duration_ms: 0, used_alias: false },
          };
        }
        if (error.message?.includes('timeout') || error.message?.includes('TIMEOUT')) {
          return {
            success: false,
            status: 'timeout',
            error: error.message,
            debug: { duration_ms: 0, used_alias: false },
          };
        }
        return {
          success: false,
          status: 'scrape_failed',
          error: error.message || 'API_ERROR',
          debug: { duration_ms: 0, used_alias: false },
        };
      }

      return data as FetchRatingResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['latest-scores'] });
      queryClient.invalidateQueries({ queryKey: ['property-google-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['google-trends'] });
      queryClient.invalidateQueries({ queryKey: ['ota-trends'] });
    },
  });
}

/**
 * Get aliases for a property to check resolution status before refresh.
 */
async function getPropertyAliases(propertyId: string): Promise<HotelAlias[]> {
  const { data, error } = await supabase
    .from('hotel_aliases')
    .select('*')
    .eq('property_id', propertyId);

  if (error) throw error;
  
  // Map DB columns to interface (handle renamed columns)
  return (data || []).map(alias => ({
    ...alias,
    source_name_raw: alias.source_name_raw,
    candidate_options: (alias.candidate_options || []) as unknown as HotelAlias['candidate_options'],
  })) as unknown as HotelAlias[];
}

/**
 * Refresh ratings for a property using ONLY resolved aliases.
 * Does NOT re-search - uses stable identifiers only.
 * 
 * Returns results for each source with clear status:
 * - found: rating fetched successfully
 * - no_alias: no alias exists, need to run resolve-identity first
 * - needs_review: alias exists but needs manual review
 * - not_listed: property confirmed not on this platform
 * - scrape_failed: API error during fetch
 * - timeout: request timed out
 */
export function useRefreshPropertyRatings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      property, 
      sources = ['google', 'tripadvisor', 'booking', 'expedia'] 
    }: RefreshPropertyRatingsParams): Promise<RefreshResult[]> => {
      const results: RefreshResult[] = [];
      
      // Get existing aliases for this property
      const aliases = await getPropertyAliases(property.id);
      const aliasMap = new Map(aliases.map(a => [a.source, a]));

      for (const source of sources) {
        const alias = aliasMap.get(source);

        // No alias exists - cannot refresh without identity resolution
        if (!alias) {
          results.push({
            source,
            result: {
              success: false,
              status: 'no_alias',
              error: 'No identity resolved - run resolve-identity first',
              debug: { duration_ms: 0, used_alias: false },
            },
          });
          continue;
        }

        // Alias not resolved - check specific status
        if (alias.resolution_status === 'not_listed') {
          results.push({
            source,
            result: {
              success: false,
              status: 'not_listed',
              debug: { duration_ms: 0, used_alias: true, alias_status: 'not_listed' },
            },
          });
          continue;
        }

        if (alias.resolution_status === 'needs_review') {
          results.push({
            source,
            result: {
              success: false,
              status: 'needs_review',
              error: 'Alias needs manual review before fetching',
              debug: { duration_ms: 0, used_alias: true, alias_status: 'needs_review' },
            },
          });
          continue;
        }

        if (alias.resolution_status !== 'resolved') {
          results.push({
            source,
            result: {
              success: false,
              status: 'scrape_failed',
              error: `Invalid alias status: ${alias.resolution_status}`,
              debug: { duration_ms: 0, used_alias: true, alias_status: alias.resolution_status },
            },
          });
          continue;
        }

        // Alias is resolved - fetch rating using stable identifier
        try {
          const { data, error } = await supabase.functions.invoke('fetch-rating-by-alias', {
            body: { propertyId: property.id, source },
          });

          if (error) {
            results.push({
              source,
              result: {
                success: false,
                status: 'scrape_failed',
                error: error.message,
                debug: { duration_ms: 0, used_alias: true, alias_status: 'resolved' },
              },
            });
          } else {
            results.push({ source, result: data as FetchRatingResult });
          }
        } catch (err) {
          results.push({
            source,
            result: {
              success: false,
              status: 'scrape_failed',
              error: err instanceof Error ? err.message : 'Unknown error',
              debug: { duration_ms: 0, used_alias: true, alias_status: 'resolved' },
            },
          });
        }

        // Rate limit delay between sources
        if (sources.indexOf(source) < sources.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['latest-scores'] });
      queryClient.invalidateQueries({ queryKey: ['google-trends'] });
      queryClient.invalidateQueries({ queryKey: ['ota-trends'] });
    },
  });
}

// Helper to get user-friendly error message
export function getRatingErrorMessage(status: RatingStatus, source: ReviewSource, error?: string): string {
  const sourceNames: Record<ReviewSource, string> = {
    google: 'Google',
    tripadvisor: 'TripAdvisor',
    booking: 'Booking.com',
    expedia: 'Expedia',
  };
  
  const sourceName = sourceNames[source];

  switch (status) {
    case 'not_listed':
      return `Property not listed on ${sourceName}`;
    case 'no_alias':
      return `No ${sourceName} identity resolved yet`;
    case 'needs_review':
      return `${sourceName} match needs manual review`;
    case 'timeout':
      return `${sourceName} request timed out`;
    case 'scrape_failed':
      if (error?.includes('RATE_LIMITED')) {
        return 'Rate limit reached, please wait';
      }
      if (error?.includes('not configured')) {
        return 'API key not configured';
      }
      return `Failed to fetch ${sourceName} rating`;
    default:
      return `Error fetching ${sourceName} data`;
  }
}
