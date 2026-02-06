import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface KasaSnapshot {
  id: string;
  property_id: string;
  score_raw: number | null;
  score_scale: number | null;
  review_count: number;
  normalized_score_0_10: number | null;
  collected_at: string;
  status: string;
}

export interface KasaPortfolioStats {
  totalProperties: number;
  totalReviews: number;
  weightedAverage: number | null;
  simpleAverage: number | null;
}

/**
 * Hook to fetch the latest Kasa snapshot for each property
 */
export function useLatestKasaSnapshots(propertyIds: string[]) {
  return useQuery({
    queryKey: ['kasa-snapshots', propertyIds],
    queryFn: async () => {
      if (propertyIds.length === 0) return {};
      
      const results: Record<string, KasaSnapshot> = {};
      
      // Fetch latest Kasa snapshot for each property
      const { data, error } = await supabase
        .from('source_snapshots')
        .select('*')
        .in('property_id', propertyIds)
        .eq('source', 'kasa')
        .order('collected_at', { ascending: false });
      
      if (error) throw error;
      
      // Get latest for each property
      for (const snapshot of data || []) {
        if (!results[snapshot.property_id]) {
          results[snapshot.property_id] = snapshot as KasaSnapshot;
        }
      }
      
      return results;
    },
    enabled: propertyIds.length > 0,
  });
}

/**
 * Calculate weighted portfolio average from Kasa snapshots
 * Formula: Σ(property_rating × review_count) / Σ(review_count)
 */
export function calculateWeightedAverage(
  snapshots: Record<string, KasaSnapshot>
): KasaPortfolioStats {
  const snapshotList = Object.values(snapshots);
  
  if (snapshotList.length === 0) {
    return {
      totalProperties: 0,
      totalReviews: 0,
      weightedAverage: null,
      simpleAverage: null,
    };
  }

  let weightedSum = 0;
  let totalReviews = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  for (const snapshot of snapshotList) {
    if (snapshot.normalized_score_0_10 !== null && snapshot.review_count > 0) {
      // For weighted average: score × reviews
      weightedSum += snapshot.normalized_score_0_10 * snapshot.review_count;
      totalReviews += snapshot.review_count;
      
      // For simple average
      scoreSum += snapshot.normalized_score_0_10;
      scoreCount++;
    }
  }

  return {
    totalProperties: snapshotList.length,
    totalReviews,
    weightedAverage: totalReviews > 0 ? weightedSum / totalReviews : null,
    simpleAverage: scoreCount > 0 ? scoreSum / scoreCount : null,
  };
}

/**
 * Hook to save a new Kasa snapshot
 */
export function useSaveKasaSnapshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      propertyId,
      rating,
      reviewCount,
    }: {
      propertyId: string;
      rating: number | null;
      reviewCount: number;
    }) => {
      // Normalize to 0-10 scale (Kasa uses 1-5)
      const normalizedScore = rating !== null ? rating * 2 : null;
      
      const { error } = await supabase.from('source_snapshots').insert({
        property_id: propertyId,
        source: 'kasa',
        score_raw: rating,
        score_scale: 5,
        review_count: reviewCount,
        normalized_score_0_10: normalizedScore,
        status: rating !== null ? 'found' : 'not_listed',
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kasa-snapshots'] });
    },
  });
}

/**
 * Hook for batch saving multiple Kasa snapshots
 */
export function useBatchSaveKasaSnapshots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      snapshots: Array<{
        propertyId: string;
        rating: number | null;
        reviewCount: number;
      }>
    ) => {
      const inserts = snapshots.map(({ propertyId, rating, reviewCount }) => ({
        property_id: propertyId,
        source: 'kasa' as const,
        score_raw: rating,
        score_scale: 5,
        review_count: reviewCount,
        normalized_score_0_10: rating !== null ? rating * 2 : null,
        status: rating !== null ? 'found' : 'not_listed',
      }));
      
      const { error } = await supabase.from('source_snapshots').insert(inserts);
      if (error) throw error;
      
      return inserts.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kasa-snapshots'] });
    },
  });
}
