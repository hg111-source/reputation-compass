 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { SourceSnapshot, GroupSnapshot, ReviewSource } from '@/lib/types';
 import { generateSampleScores } from '@/lib/scoring';
 
 export function usePropertySnapshots(propertyId: string | null) {
   return useQuery({
     queryKey: ['property-snapshots', propertyId],
     queryFn: async () => {
       if (!propertyId) return [];
       const { data, error } = await supabase
         .from('source_snapshots')
         .select('*')
         .eq('property_id', propertyId)
         .order('collected_at', { ascending: false });
       if (error) throw error;
       return data as SourceSnapshot[];
     },
     enabled: !!propertyId,
   });
 }
 
export interface PlatformScore {
  score: number | null;
  count: number;
  updated: string;
  status?: 'found' | 'not_listed';
}

export function useLatestPropertyScores(propertyIds: string[]) {
  return useQuery({
    queryKey: ['latest-scores', propertyIds],
    queryFn: async () => {
      if (propertyIds.length === 0) return {};
      
      // BATCH QUERY: Fetch ALL snapshots for all properties in ONE call
      const { data: allSnapshots, error } = await supabase
        .from('source_snapshots')
        .select('*')
        .in('property_id', propertyIds)
        .order('collected_at', { ascending: false });
      
      if (error) throw error;
      
      // Process client-side: group by property and find latest per source
      const results: Record<string, Record<ReviewSource, PlatformScore>> = {};
      
      // Initialize empty records for all properties
      for (const propertyId of propertyIds) {
        results[propertyId] = {} as Record<ReviewSource, PlatformScore>;
      }
      
      // Since data is ordered by collected_at desc, first occurrence per property/source is latest
      const seenKeys = new Set<string>();
      
      for (const snapshot of allSnapshots || []) {
        const key = `${snapshot.property_id}:${snapshot.source}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        
        const snapshotWithStatus = snapshot as SourceSnapshot & { status?: string };
        results[snapshot.property_id][snapshot.source as ReviewSource] = {
          score: snapshotWithStatus.normalized_score_0_10,
          count: snapshotWithStatus.review_count,
          updated: snapshotWithStatus.collected_at,
          status: (snapshotWithStatus.status as 'found' | 'not_listed') || 'found',
        };
      }
      
      return results;
    },
    enabled: propertyIds.length > 0,
  });
}
 
 export function useGroupSnapshots(groupId: string | null) {
   return useQuery({
     queryKey: ['group-snapshots', groupId],
     queryFn: async () => {
       if (!groupId) return [];
       const { data, error } = await supabase
         .from('group_snapshots')
         .select('*')
         .eq('group_id', groupId)
         .order('collected_at', { ascending: false });
       if (error) throw error;
       return data as GroupSnapshot[];
     },
     enabled: !!groupId,
   });
 }
 
 export function useRefreshScores() {
   const queryClient = useQueryClient();
 
   const refreshProperty = useMutation({
     mutationFn: async (propertyId: string) => {
       const scores = generateSampleScores();
       const inserts = scores.map(s => ({
         property_id: propertyId,
         source: s.source,
         score_raw: s.score_raw,
         score_scale: s.score_scale,
         review_count: s.review_count,
         normalized_score_0_10: s.normalized_score_0_10,
       }));
       
       const { error } = await supabase.from('source_snapshots').insert(inserts);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['property-snapshots'] });
       queryClient.invalidateQueries({ queryKey: ['latest-scores'] });
     },
   });
 
  /**
   * Recalculates the group weighted average from current property scores.
   * 
   * Formula: groupWeightedAvg = Σ(hotelWeightedAvg × hotelTotalReviews) / Σ(allTotalReviews)
   * 
   * This does NOT refresh individual property scores - use the unified refresh for that.
   * This function aggregates existing scores and saves a new group snapshot.
   */
  const refreshGroup = useMutation({
    mutationFn: async ({ groupId, propertyIds }: { groupId: string; propertyIds: string[] }) => {
      if (propertyIds.length === 0) {
        throw new Error('No properties in group');
      }

      // Get latest snapshot for each property/source combination
      const latestScores: Record<string, Record<string, { score: number; count: number }>> = {};
      
      for (const propertyId of propertyIds) {
        const { data: snapshots, error } = await supabase
          .from('source_snapshots')
          .select('source, normalized_score_0_10, review_count, status')
          .eq('property_id', propertyId)
          .order('collected_at', { ascending: false });
        
        if (error) throw error;
        
        // Get latest for each source
        latestScores[propertyId] = {};
        const seenSources = new Set<string>();
        
        for (const snapshot of snapshots || []) {
          if (!seenSources.has(snapshot.source) && snapshot.status === 'found') {
            seenSources.add(snapshot.source);
            if (snapshot.normalized_score_0_10 && snapshot.review_count > 0) {
              latestScores[propertyId][snapshot.source] = {
                score: snapshot.normalized_score_0_10,
                count: snapshot.review_count,
              };
            }
          }
        }
      }

      // Calculate group weighted average using formula:
      // Σ(hotelWeightedAvg × hotelTotalReviews) / Σ(allTotalReviews)
      let groupWeightedSum = 0;
      let groupTotalReviews = 0;

      for (const propertyId of propertyIds) {
        const propertyScores = latestScores[propertyId] || {};
        
        // Calculate this property's weighted average
        let propertyWeightedSum = 0;
        let propertyTotalReviews = 0;
        
        for (const source of Object.keys(propertyScores)) {
          const { score, count } = propertyScores[source];
          propertyWeightedSum += score * count;
          propertyTotalReviews += count;
        }
        
        if (propertyTotalReviews > 0) {
          const propertyWeightedAvg = propertyWeightedSum / propertyTotalReviews;
          // Add to group totals: hotelWeightedAvg × hotelTotalReviews
          groupWeightedSum += propertyWeightedAvg * propertyTotalReviews;
          groupTotalReviews += propertyTotalReviews;
        }
      }

      // Calculate and save group weighted average
      if (groupTotalReviews > 0) {
        const groupWeightedAvg = groupWeightedSum / groupTotalReviews;
        
        const { error: insertError } = await supabase.from('group_snapshots').insert({
          group_id: groupId,
          weighted_score_0_10: parseFloat(groupWeightedAvg.toFixed(2)),
        });
        
        if (insertError) throw insertError;
        
        return { weightedAvg: groupWeightedAvg, totalReviews: groupTotalReviews };
      }
      
      return { weightedAvg: null, totalReviews: 0 };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-snapshots'] });
    },
  });
 
   return { refreshProperty, refreshGroup };
 }