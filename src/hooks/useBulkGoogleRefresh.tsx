import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/lib/types';
import { PropertyRefreshState, RefreshStatus } from '@/components/properties/BulkRefreshDialog';
import { useToast } from '@/hooks/use-toast';
import { getGoogleRatingErrorMessage } from '@/hooks/useGoogleRatings';

const DELAY_BETWEEN_CALLS_MS = 2000;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function useBulkGoogleRefresh() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [propertyStates, setPropertyStates] = useState<PropertyRefreshState[]>([]);
  const dialogOpenRef = useRef(true);

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

  const fetchSingleProperty = useCallback(async (property: Property): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-place-rating', {
        body: {
          hotelName: property.name,
          city: `${property.city}, ${property.state}`,
        },
      });

      if (error) {
        if (error.message?.includes('rate limit') || error.message?.includes('429')) {
          return { success: false, error: 'Rate limit reached' };
        }
        return { success: false, error: 'API error' };
      }

      if (data.error) {
        if (data.error.includes('GOOGLE_PLACES_API_KEY')) {
          return { success: false, error: 'API key not configured' };
        }
        return { success: false, error: 'API error' };
      }

      if (!data.found) {
        return { success: false, error: 'Hotel not found on Google' };
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
          return { success: false, error: 'Error saving data' };
        }
      }

      return { success: true };
    } catch {
      return { success: false, error: 'Unexpected error' };
    }
  }, []);

  const startBulkRefresh = useCallback(async (properties: Property[]) => {
    if (properties.length === 0) return;

    setIsRunning(true);
    setIsComplete(false);
    dialogOpenRef.current = true;
    
    const initialStates: PropertyRefreshState[] = properties.map(property => ({
      property,
      status: 'queued' as RefreshStatus,
    }));
    setPropertyStates(initialStates);

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];

      // Mark as in progress
      updatePropertyStatus(property.id, 'in_progress');

      // Fetch the rating
      const result = await fetchSingleProperty(property);

      if (result.success) {
        successCount++;
        updatePropertyStatus(property.id, 'complete');
      } else {
        failureCount++;
        updatePropertyStatus(property.id, 'failed', result.error);
      }

      // Invalidate queries to update the table in real-time
      queryClient.invalidateQueries({ queryKey: ['property-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['latest-scores'] });

      // Delay before next call (unless it's the last one)
      if (i < properties.length - 1) {
        await delay(DELAY_BETWEEN_CALLS_MS);
      }
    }

    setIsRunning(false);
    setIsComplete(true);

    // Show toast if dialog was closed during execution
    if (!dialogOpenRef.current) {
      toast({
        title: 'Bulk refresh complete',
        description: `${successCount} succeeded, ${failureCount} failed`,
      });
    }
  }, [fetchSingleProperty, queryClient, updatePropertyStatus, toast]);

  const retryProperty = useCallback(async (property: Property) => {
    updatePropertyStatus(property.id, 'in_progress');
    
    const result = await fetchSingleProperty(property);
    
    if (result.success) {
      updatePropertyStatus(property.id, 'complete');
      toast({
        title: 'Retry successful',
        description: `${property.name} updated successfully`,
      });
    } else {
      updatePropertyStatus(property.id, 'failed', result.error);
      toast({
        variant: 'destructive',
        title: 'Retry failed',
        description: getGoogleRatingErrorMessage(result.error || 'API_ERROR'),
      });
    }

    queryClient.invalidateQueries({ queryKey: ['property-snapshots'] });
    queryClient.invalidateQueries({ queryKey: ['latest-scores'] });
  }, [fetchSingleProperty, queryClient, updatePropertyStatus, toast]);

  const setDialogOpen = useCallback((open: boolean) => {
    dialogOpenRef.current = open;
  }, []);

  const reset = useCallback(() => {
    setPropertyStates([]);
    setIsRunning(false);
    setIsComplete(false);
  }, []);

  return {
    isRunning,
    isComplete,
    propertyStates,
    startBulkRefresh,
    retryProperty,
    setDialogOpen,
    reset,
  };
}
