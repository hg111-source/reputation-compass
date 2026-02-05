import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/lib/types';

export type OTASource = 'tripadvisor' | 'booking' | 'expedia';

interface OTARatingResult {
  found: boolean;
  name?: string;
  rating?: number | null;
  reviewCount?: number;
  scale?: number;
  message?: string;
  error?: string;
}

interface FetchOTARatingParams {
  property: Property;
  source: OTASource;
}

const SOURCE_CONFIG: Record<OTASource, { functionName: string; displayName: string }> = {
  tripadvisor: { functionName: 'fetch-tripadvisor-rating', displayName: 'TripAdvisor' },
  booking: { functionName: 'fetch-booking-rating', displayName: 'Booking.com' },
  expedia: { functionName: 'fetch-expedia-rating', displayName: 'Expedia' },
};

export function useOTARatings() {
  const queryClient = useQueryClient();

  const fetchOTARating = useMutation({
    mutationFn: async ({ property, source }: FetchOTARatingParams): Promise<OTARatingResult> => {
      const config = SOURCE_CONFIG[source];
      
      const { data, error } = await supabase.functions.invoke(config.functionName, {
        body: {
          hotelName: property.name,
          city: `${property.city}, ${property.state}`,
        },
      });

      if (error) {
        if (error.message?.includes('rate limit') || error.message?.includes('429')) {
          throw new Error('RATE_LIMIT');
        }
        if (error.message?.includes('timeout')) {
          throw new Error('TIMEOUT');
        }
        throw new Error('API_ERROR');
      }

      if (data.error) {
        if (data.error.includes('APIFY_API_TOKEN')) {
          throw new Error('API_KEY_NOT_CONFIGURED');
        }
        throw new Error('API_ERROR');
      }

      if (!data.found) {
        throw new Error('NOT_FOUND');
      }

      // Store the result in source_snapshots
      if (data.rating !== null && data.rating !== undefined) {
        const scale = data.scale || 5;
        const normalizedScore = scale === 10 ? data.rating : (data.rating / scale) * 10;
        
        const { error: insertError } = await supabase.from('source_snapshots').insert({
          property_id: property.id,
          source: source,
          score_raw: data.rating,
          score_scale: scale,
          review_count: data.reviewCount || 0,
          normalized_score_0_10: parseFloat(normalizedScore.toFixed(2)),
        });

        if (insertError) {
          console.error('Error saving snapshot:', insertError);
          throw new Error('SAVE_ERROR');
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['latest-scores'] });
      queryClient.invalidateQueries({ queryKey: ['ota-trends'] });
    },
  });

  return { fetchOTARating };
}

export function getOTARatingErrorMessage(errorCode: string, source: OTASource): string {
  const displayName = SOURCE_CONFIG[source].displayName;
  
  switch (errorCode) {
    case 'NOT_FOUND':
      return `Could not find hotel on ${displayName}`;
    case 'RATE_LIMIT':
      return 'Rate limit reached, please wait';
    case 'TIMEOUT':
      return 'Request timed out, please try again';
    case 'API_KEY_NOT_CONFIGURED':
      return 'Apify API token not configured';
    case 'SAVE_ERROR':
      return 'Error saving rating data';
    case 'API_ERROR':
    default:
      return `Error fetching ${displayName} reviews`;
  }
}
