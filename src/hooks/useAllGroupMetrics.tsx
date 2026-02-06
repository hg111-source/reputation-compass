import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLatestPropertyScores } from './useSnapshots';
import { calculatePropertyMetrics } from '@/lib/scoring';
import { useAuth } from './useAuth';
import { Group, Property } from '@/lib/types';

interface GroupMetricsSummary {
  groupId: string;
  avgScore: number | null;
  totalProperties: number;
  totalReviews: number;
}

/**
 * Fetches metrics for all groups at once and provides sorting capability.
 * This allows groups to be sorted by their weighted average score.
 */
export function useAllGroupMetrics(groups: Group[]) {
  const { user } = useAuth();
  const groupIds = groups.map(g => g.id);

  // Fetch all group-property mappings at once
  const { data: allGroupProperties = [], isLoading: propertiesLoading, refetch: refetchProperties } = useQuery({
    queryKey: ['all-group-properties', groupIds.join(',')],
    queryFn: async () => {
      if (groupIds.length === 0) return [];
      const { data, error } = await supabase
        .from('group_properties')
        .select(`
          group_id,
          property_id,
          properties:property_id (*)
        `)
        .in('group_id', groupIds);
      if (error) throw error;
      return data as { group_id: string; property_id: string; properties: Property }[];
    },
    enabled: groupIds.length > 0 && !!user,
  });

  // Get all unique property IDs across all groups
  const allPropertyIds = useMemo(() => {
    const ids = new Set<string>();
    allGroupProperties.forEach(gp => ids.add(gp.property_id));
    return Array.from(ids);
  }, [allGroupProperties]);

  // Fetch scores for all properties at once
  const { data: scores = {}, isLoading: scoresLoading, refetch: refetchScores } = useLatestPropertyScores(allPropertyIds);

  // Refetch function to re-sort groups
  const refetch = async () => {
    await Promise.all([refetchProperties(), refetchScores()]);
  };

  // Calculate metrics for each group
  const groupMetrics = useMemo(() => {
    const metricsMap: Record<string, GroupMetricsSummary> = {};

    for (const group of groups) {
      const groupProps = allGroupProperties.filter(gp => gp.group_id === group.id);
      
      let weightedSum = 0;
      let totalReviews = 0;

      for (const gp of groupProps) {
        const propertyScores = scores[gp.property_id];
        const { avgScore, totalReviews: propReviews } = calculatePropertyMetrics(propertyScores);

        if (avgScore !== null && propReviews > 0) {
          weightedSum += avgScore * propReviews;
          totalReviews += propReviews;
        }
      }

      metricsMap[group.id] = {
        groupId: group.id,
        avgScore: totalReviews > 0 ? weightedSum / totalReviews : null,
        totalProperties: groupProps.length,
        totalReviews,
      };
    }

    return metricsMap;
  }, [groups, allGroupProperties, scores]);

  // Sort groups by avgScore (descending, nulls last)
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      const aScore = groupMetrics[a.id]?.avgScore;
      const bScore = groupMetrics[b.id]?.avgScore;
      
      // Nulls go last
      if (aScore === null && bScore === null) return 0;
      if (aScore === null) return 1;
      if (bScore === null) return -1;
      
      // Higher scores first
      return bScore - aScore;
    });
  }, [groups, groupMetrics]);

  return {
    groupMetrics,
    sortedGroups,
    isLoading: propertiesLoading || scoresLoading,
    refetch,
  };
}
