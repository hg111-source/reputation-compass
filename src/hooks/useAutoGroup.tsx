import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property, ReviewSource } from '@/lib/types';
import { useAuth } from './useAuth';
import { calculatePropertyMetrics } from '@/lib/scoring';

interface GroupDefinition {
  name: string;
  propertyIds: string[];
}

export type AutoGroupStrategy = 'state' | 'score';

interface ScoreData {
  [propertyId: string]: Record<ReviewSource, { score: number; count: number }> | undefined;
}

export function useAutoGroup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const generateGroups = (
    properties: Property[],
    scores: ScoreData,
    strategy: AutoGroupStrategy
  ): GroupDefinition[] => {
    switch (strategy) {
      case 'state':
        return groupByState(properties);
      case 'score':
        return groupByScore(properties, scores);
      default:
        return [];
    }
  };

  const groupByState = (properties: Property[]): GroupDefinition[] => {
    const stateMap = new Map<string, string[]>();
    
    for (const property of properties) {
      const state = property.state.trim();
      if (!stateMap.has(state)) {
        stateMap.set(state, []);
      }
      stateMap.get(state)!.push(property.id);
    }

    return Array.from(stateMap.entries())
      .filter(([_, ids]) => ids.length > 0)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([state, propertyIds]) => ({
        name: `${state} Properties`,
        propertyIds,
      }));
  };

  const groupByScore = (properties: Property[], scores: ScoreData): GroupDefinition[] => {
    return groupByScoreWithThresholds(properties, scores, { elite: 9.0, strong: 8.0, attention: 0 });
  };

  const groupByScoreWithThresholds = (
    properties: Property[], 
    scores: ScoreData,
    thresholds: { elite: number; strong: number; attention: number }
  ): GroupDefinition[] => {
    const topPerformers: string[] = [];
    const strong: string[] = [];
    const needsAttention: string[] = [];

    for (const property of properties) {
      const { avgScore } = calculatePropertyMetrics(scores[property.id]);
      
      if (avgScore === null) {
        needsAttention.push(property.id);
      } else if (avgScore >= thresholds.elite) {
        topPerformers.push(property.id);
      } else if (avgScore >= thresholds.strong) {
        strong.push(property.id);
      } else {
        needsAttention.push(property.id);
      }
    }

    const groups: GroupDefinition[] = [];
    
    if (topPerformers.length > 0) {
      groups.push({ name: `Top Performers (${thresholds.elite}+)`, propertyIds: topPerformers });
    }
    if (strong.length > 0) {
      groups.push({ name: `Strong (${thresholds.strong}-${(thresholds.elite - 0.1).toFixed(1)})`, propertyIds: strong });
    }
    if (needsAttention.length > 0) {
      groups.push({ name: `Needs Attention (below ${thresholds.strong})`, propertyIds: needsAttention });
    }

    return groups;
  };

  const generateGroupsWithThresholds = (
    properties: Property[],
    scores: ScoreData,
    thresholds: { elite: number; strong: number; attention: number }
  ): GroupDefinition[] => {
    return groupByScoreWithThresholds(properties, scores, thresholds);
  };

  const createAutoGroups = useMutation({
    mutationFn: async (groupDefinitions: GroupDefinition[]) => {
      if (!user) throw new Error('Not authenticated');
      
      const createdGroups: { name: string; propertyCount: number }[] = [];

      for (const def of groupDefinitions) {
        // Create the group
        const { data: group, error: groupError } = await supabase
          .from('groups')
          .insert({ name: def.name, user_id: user.id })
          .select()
          .single();
        
        if (groupError) throw groupError;

        // Add properties to the group
        if (def.propertyIds.length > 0) {
          const { error: propsError } = await supabase
            .from('group_properties')
            .insert(def.propertyIds.map(pid => ({
              group_id: group.id,
              property_id: pid,
            })));
          
          if (propsError) throw propsError;
        }

        createdGroups.push({
          name: def.name,
          propertyCount: def.propertyIds.length,
        });
      }

      return createdGroups;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group-properties'] });
    },
  });

  return {
    generateGroups,
    generateGroupsWithThresholds,
    createAutoGroups,
  };
}
