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
  expedia: { functionName: 'fetch-expedia-rating', displayName: 'Expedia' }, // Uses RapidAPI reviews/scores endpoint
};

export function useOTARatings() {
  const queryClient = useQueryClient();

  const fetchOTARating = useMutation({
    mutationFn: async ({ property, source }: FetchOTARatingParams): Promise<OTARatingResult> => {
      const config = SOURCE_CONFIG[source];
      
      // For expedia, use the new Hotels.com API which takes propertyId
      if (source === 'expedia') {
        const { data, error } = await supabase.functions.invoke(config.functionName, {
          body: {
            propertyId: property.id,
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

        if (!data.success) {
          if (data.status === 'no_alias' || data.status === 'no_hotel_id') {
            throw new Error('NO_HOTEL_ID');
          }
          if (data.status === 'not_listed') {
            throw new Error('NOT_LISTED');
          }
          if (data.status === 'rate_limited') {
            throw new Error('RATE_LIMIT');
          }
          throw new Error('NOT_FOUND');
        }

        // The function already saves to source_snapshots, so just return the result
        return {
          found: true,
          rating: data.rating,
          reviewCount: data.reviewCount,
          scale: data.scale,
        };
      }
      
      // For other sources, use the existing flow
      const urlField = `${source}_url` as 'tripadvisor_url' | 'booking_url' | 'expedia_url';
      const startUrl = property[urlField] || undefined;
      
      const { data, error } = await supabase.functions.invoke(config.functionName, {
        body: {
          hotelName: property.name,
          city: `${property.city}, ${property.state}`,
          startUrl, // Pass the pre-resolved URL if available
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
    case 'NOT_LISTED':
      return `Hotel not listed on ${displayName}`;
    case 'NO_HOTEL_ID':
      return 'Run "Resolve URLs" first to get Hotels.com ID';
    case 'RATE_LIMIT':
      return 'Rate limit reached, please wait';
    case 'TIMEOUT':
      return 'Request timed out, please try again';
    case 'API_KEY_NOT_CONFIGURED':
      return source === 'expedia' ? 'RapidAPI key not configured' : 'Apify API token not configured';
    case 'SAVE_ERROR':
      return 'Error saving rating data';
    case 'API_ERROR':
    default:
      return `Error fetching ${displayName} reviews`;
  }
}
