import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ReviewSource } from './useHotelAliases';

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

export function useFetchRatingByAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, source }: FetchRatingParams): Promise<FetchRatingResult> => {
      const { data, error } = await supabase.functions.invoke('fetch-rating-by-alias', {
        body: {
          propertyId,
          source,
        },
      });

      if (error) {
        // Check for specific error types
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
    onSuccess: (_, { propertyId }) => {
      queryClient.invalidateQueries({ queryKey: ['property-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['latest-scores'] });
      queryClient.invalidateQueries({ queryKey: ['property-google-snapshots'] });
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
      return `No ${sourceName} identity resolved - run resolution first`;
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
