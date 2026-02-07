import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/lib/types';
import { useQueryClient } from '@tanstack/react-query';

interface BulkInsightState {
  propertyId: string;
  propertyName: string;
  status: 'pending' | 'fetching' | 'analyzing' | 'done' | 'error';
  error?: string;
}

export function useBulkInsights() {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [states, setStates] = useState<BulkInsightState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const abortRef = useRef(false);

  const updateState = (propertyId: string, update: Partial<BulkInsightState>) => {
    setStates(prev => prev.map(s => s.propertyId === propertyId ? { ...s, ...update } : s));
  };

  const run = useCallback(async (properties: Property[]) => {
    if (isRunning) return;
    abortRef.current = false;
    setIsRunning(true);
    setCurrentIndex(0);

    const initialStates: BulkInsightState[] = properties.map(p => ({
      propertyId: p.id,
      propertyName: p.name,
      status: 'pending',
    }));
    setStates(initialStates);

    for (let i = 0; i < properties.length; i++) {
      if (abortRef.current) break;
      const property = properties[i];
      setCurrentIndex(i);

      try {
        // Fetch TripAdvisor reviews
        updateState(property.id, { status: 'fetching' });
        await supabase.functions.invoke('fetch-reviews', {
          body: {
            propertyId: property.id,
            hotelName: property.name,
            city: property.city,
            platform: 'tripadvisor',
            maxReviews: 25,
          },
        });

        if (abortRef.current) break;

        // Fetch Google reviews
        await supabase.functions.invoke('fetch-reviews', {
          body: {
            propertyId: property.id,
            hotelName: property.name,
            city: property.city,
            platform: 'google',
            maxReviews: 25,
          },
        });

        if (abortRef.current) break;

        // AI analysis
        updateState(property.id, { status: 'analyzing' });
        const { data, error } = await supabase.functions.invoke('analyze-reviews', {
          body: { propertyId: property.id },
        });

        if (error || data?.error) {
          throw new Error(data?.error || error?.message || 'Analysis failed');
        }

        updateState(property.id, { status: 'done' });

        // Invalidate caches
        queryClient.invalidateQueries({ queryKey: ['review-analysis', property.id] });
        queryClient.invalidateQueries({ queryKey: ['review-texts-count', property.id] });

      } catch (err) {
        updateState(property.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      // Small delay between properties to avoid rate limiting
      if (i < properties.length - 1 && !abortRef.current) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Refresh the properties-with-reviews query
    queryClient.invalidateQueries({ queryKey: ['properties-with-reviews'] });
    setIsRunning(false);
  }, [isRunning, queryClient]);

  const cancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  const doneCount = states.filter(s => s.status === 'done').length;
  const errorCount = states.filter(s => s.status === 'error').length;
  const progress = states.length > 0 ? ((doneCount + errorCount) / states.length) * 100 : 0;

  return {
    run,
    cancel,
    isRunning,
    states,
    currentIndex,
    doneCount,
    errorCount,
    progress,
    total: states.length,
  };
}
