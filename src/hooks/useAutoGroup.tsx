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

  // Score Legend tiers with exact ranges
  const SCORE_TIERS = [
    { name: 'Wonderful (9.0+)', min: 9.0, max: 10 },
    { name: 'Very Good (8.0-8.99)', min: 8.0, max: 8.99 },
    { name: 'Good (7.0-7.99)', min: 7.0, max: 7.99 },
    { name: 'Pleasant (6.0-6.99)', min: 6.0, max: 6.99 },
    { name: 'Needs Work (0-5.99)', min: 0, max: 5.99 },
  ];

  const groupByScore = (properties: Property[], scores: ScoreData): GroupDefinition[] => {
    const buckets: Map<string, string[]> = new Map();
    
    // Initialize all buckets
    for (const tier of SCORE_TIERS) {
      buckets.set(tier.name, []);
    }

    for (const property of properties) {
      const { avgScore } = calculatePropertyMetrics(scores[property.id]);
      
      // Find the right tier based on score
      let tierName = 'Needs Work (0-5.99)';
      if (avgScore !== null) {
        if (avgScore >= 9.0) {
          tierName = 'Wonderful (9.0+)';
        } else if (avgScore >= 8.0) {
          tierName = 'Very Good (8.0-8.99)';
        } else if (avgScore >= 7.0) {
          tierName = 'Good (7.0-7.99)';
        } else if (avgScore >= 6.0) {
          tierName = 'Pleasant (6.0-6.99)';
        } else {
          tierName = 'Needs Work (0-5.99)';
        }
      }
      
      buckets.get(tierName)!.push(property.id);
    }

    // Return ALL groups including empty ones (for future use)
    return SCORE_TIERS.map(tier => ({
      name: tier.name,
      propertyIds: buckets.get(tier.name) || [],
    }));
  };

  const groupByScoreWithThresholds = (
    properties: Property[], 
    scores: ScoreData,
    _thresholds: { elite: number; strong: number; attention: number }
  ): GroupDefinition[] => {
    // Now uses the standard 5-tier system regardless of thresholds
    return groupByScore(properties, scores);
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
