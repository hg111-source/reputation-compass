import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/lib/types';
import { PropertyRefreshState, RefreshStatus } from '@/components/properties/BulkRefreshDialog';

const DELAY_BETWEEN_CALLS_MS = 2000;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function useBulkGoogleRefresh() {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [propertyStates, setPropertyStates] = useState<PropertyRefreshState[]>([]);

  const updatePropertyStatus = useCallback((
    propertyId: string,
    status: RefreshStatus,
    error?: string
  ) => {
    setPropertyStates(prev =>
      prev.map(p =>
        p.property.id === propertyId
          ? { ...p, status, error }
          : p
      )
    );
  }, []);

  const fetchSingleProperty = useCallback(async (property: Property): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-place-rating', {
        body: {
          hotelName: property.name,
          city: `${property.city}, ${property.state}`,
        },
      });

      if (error) {
        throw new Error(error.message || 'API_ERROR');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.found) {
        throw new Error('NOT_FOUND');
      }

      // Store the result
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
          throw new Error('SAVE_ERROR');
        }
      }

      return true;
    } catch {
      return false;
    }
  }, []);

  const startBulkRefresh = useCallback(async (properties: Property[]) => {
    if (properties.length === 0) return;

    setIsRunning(true);
    setPropertyStates(
      properties.map(property => ({
        property,
        status: 'queued' as RefreshStatus,
      }))
    );

    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];

      // Mark as in progress
      updatePropertyStatus(property.id, 'in_progress');

      // Fetch the rating
      const success = await fetchSingleProperty(property);

      // Mark as complete or failed
      updatePropertyStatus(
        property.id,
        success ? 'complete' : 'failed',
        success ? undefined : 'Could not fetch rating'
      );

      // Invalidate queries to update the table in real-time
      queryClient.invalidateQueries({ queryKey: ['property-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['latest-scores'] });

      // Delay before next call (unless it's the last one)
      if (i < properties.length - 1) {
        await delay(DELAY_BETWEEN_CALLS_MS);
      }
    }

    setIsRunning(false);
  }, [fetchSingleProperty, queryClient, updatePropertyStatus]);

  const reset = useCallback(() => {
    setPropertyStates([]);
    setIsRunning(false);
  }, []);

  return {
    isRunning,
    propertyStates,
    startBulkRefresh,
    reset,
  };
}
