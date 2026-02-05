import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/lib/types';

interface GoogleRatingResult {
  found: boolean;
  name?: string;
  address?: string;
  rating?: number | null;
  reviewCount?: number;
  message?: string;
  error?: string;
}

interface FetchGoogleRatingParams {
  property: Property;
}

export function useGoogleRatings() {
  const queryClient = useQueryClient();

  const fetchGoogleRating = useMutation({
    mutationFn: async ({ property }: FetchGoogleRatingParams): Promise<GoogleRatingResult> => {
      // Call the edge function
      const { data, error } = await supabase.functions.invoke('fetch-place-rating', {
        body: {
          hotelName: property.name,
          city: `${property.city}, ${property.state}`,
        },
      });

      if (error) {
        // Check for rate limit
        if (error.message?.includes('rate limit') || error.message?.includes('429')) {
          throw new Error('RATE_LIMIT');
        }
        throw new Error('API_ERROR');
      }

      if (data.error) {
        if (data.error.includes('GOOGLE_PLACES_API_KEY')) {
          throw new Error('API_KEY_NOT_CONFIGURED');
        }
        throw new Error('API_ERROR');
      }

      if (!data.found) {
        throw new Error('NOT_FOUND');
      }

      // Store the result in source_snapshots
      if (data.rating !== null && data.rating !== undefined) {
        const normalizedScore = (data.rating / 5) * 10;
        
        const { error: insertError } = await supabase.from('source_snapshots').insert({
          property_id: property.id,
          source: 'google',
          score_raw: data.rating,
          score_scale: 5,
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
      queryClient.invalidateQueries({ queryKey: ['property-google-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['google-trends'] });
    },
  });

  return { fetchGoogleRating };
}

export function getGoogleRatingErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'NOT_FOUND':
      return 'Could not find hotel on Google';
    case 'RATE_LIMIT':
      return 'Rate limit reached, please wait';
    case 'API_KEY_NOT_CONFIGURED':
      return 'Google API key not configured';
    case 'SAVE_ERROR':
      return 'Error saving rating data';
    case 'API_ERROR':
    default:
      return 'Error fetching reviews, please try again';
  }
}
