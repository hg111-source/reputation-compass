 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { SourceSnapshot, GroupSnapshot, ReviewSource } from '@/lib/types';
 import { generateSampleScores, calculateWeightedScore } from '@/lib/scoring';
 
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
 
 export function useLatestPropertyScores(propertyIds: string[]) {
   return useQuery({
     queryKey: ['latest-scores', propertyIds],
     queryFn: async () => {
       if (propertyIds.length === 0) return {};
       
       const results: Record<string, Record<ReviewSource, { score: number; count: number; updated: string }>> = {};
       
       for (const propertyId of propertyIds) {
         const { data, error } = await supabase
           .from('source_snapshots')
           .select('*')
           .eq('property_id', propertyId)
           .order('collected_at', { ascending: false });
         
         if (error) throw error;
         
         const latestBySource: Record<string, SourceSnapshot> = {};
         for (const snapshot of data || []) {
           if (!latestBySource[snapshot.source]) {
             latestBySource[snapshot.source] = snapshot;
           }
         }
         
         results[propertyId] = {} as Record<ReviewSource, { score: number; count: number; updated: string }>;
         for (const [source, snapshot] of Object.entries(latestBySource)) {
           results[propertyId][source as ReviewSource] = {
             score: snapshot.normalized_score_0_10,
             count: snapshot.review_count,
             updated: snapshot.collected_at,
           };
         }
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
 
   const refreshGroup = useMutation({
     mutationFn: async ({ groupId, propertyIds }: { groupId: string; propertyIds: string[] }) => {
       // Refresh all properties in the group
       for (const propertyId of propertyIds) {
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
       }
       
       // Calculate and save group weighted score
       const { data: latestSnapshots } = await supabase
         .from('source_snapshots')
         .select('*')
         .in('property_id', propertyIds)
         .order('collected_at', { ascending: false });
       
       if (latestSnapshots && latestSnapshots.length > 0) {
         const allScores = latestSnapshots.map(s => ({
           normalized: s.normalized_score_0_10,
           count: s.review_count,
         }));
         
         const weightedScore = calculateWeightedScore(allScores);
         
         if (weightedScore !== null) {
           const { error } = await supabase.from('group_snapshots').insert({
             group_id: groupId,
             weighted_score_0_10: parseFloat(weightedScore.toFixed(2)),
           });
           if (error) throw error;
         }
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['property-snapshots'] });
       queryClient.invalidateQueries({ queryKey: ['latest-scores'] });
       queryClient.invalidateQueries({ queryKey: ['group-snapshots'] });
     },
   });
 
   return { refreshProperty, refreshGroup };
 }