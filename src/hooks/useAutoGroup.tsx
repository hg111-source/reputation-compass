import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property, ReviewSource } from '@/lib/types';
import { useAuth } from './useAuth';
import { calculatePropertyMetrics } from '@/lib/scoring';

interface GroupDefinition {
  name: string;
  propertyIds: string[];
  isPublic: boolean;
}

export type AutoGroupStrategy = 'state' | 'score';
export type PropertyFilter = 'all' | 'kasa' | 'competitors';

interface ScoreData {
  [propertyId: string]: Record<ReviewSource, { score: number; count: number }> | undefined;
}

// Score Legend tiers with exact ranges
const SCORE_TIERS = [
  { name: 'Wonderful (9.0+)', min: 9.0, max: 10 },
  { name: 'Very Good (8.0-8.99)', min: 8.0, max: 8.99 },
  { name: 'Good (7.0-7.99)', min: 7.0, max: 7.99 },
  { name: 'Pleasant (6.0-6.99)', min: 6.0, max: 6.99 },
  { name: 'Needs Work (0-5.99)', min: 0, max: 5.99 },
];

function isKasaProperty(property: Property): boolean {
  return !!(property.kasa_url || property.kasa_aggregated_score !== null);
}

function filterProperties(properties: Property[], filter: PropertyFilter): Property[] {
  switch (filter) {
    case 'kasa':
      return properties.filter(isKasaProperty);
    case 'competitors':
      return properties.filter(p => !isKasaProperty(p));
    default:
      return properties;
  }
}

export function useAutoGroup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const generateGroups = (
    properties: Property[],
    scores: ScoreData,
    strategy: AutoGroupStrategy,
    filter: PropertyFilter = 'all'
  ): GroupDefinition[] => {
    const filtered = filterProperties(properties, filter);
    switch (strategy) {
      case 'state':
        return groupByState(filtered, properties);
      case 'score':
        return groupByScore(filtered, scores, filter);
      default:
        return [];
    }
  };

  const groupByState = (filtered: Property[], allProperties: Property[]): GroupDefinition[] => {
    // Collect all states from filtered properties
    const stateMap = new Map<string, { kasa: string[]; comp: string[] }>();

    for (const property of filtered) {
      const state = property.state.trim();
      if (!stateMap.has(state)) {
        stateMap.set(state, { kasa: [], comp: [] });
      }
      const bucket = stateMap.get(state)!;
      if (isKasaProperty(property)) {
        bucket.kasa.push(property.id);
      } else {
        bucket.comp.push(property.id);
      }
    }

    const groups: GroupDefinition[] = [];

    // Sort by total count descending
    const sorted = Array.from(stateMap.entries()).sort(
      (a, b) => (b[1].kasa.length + b[1].comp.length) - (a[1].kasa.length + a[1].comp.length)
    );

    for (const [state, bucket] of sorted) {
      if (bucket.comp.length > 0) {
        groups.push({
          name: `${state}_Comp Set`,
          propertyIds: bucket.comp,
          isPublic: true,
        });
      }
      if (bucket.kasa.length > 0) {
        groups.push({
          name: `${state}_Kasa`,
          propertyIds: bucket.kasa,
          isPublic: true,
        });
      }
    }

    return groups;
  };

  const groupByScore = (
    properties: Property[],
    scores: ScoreData,
    filter: PropertyFilter
  ): GroupDefinition[] => {
    const buckets: Map<string, string[]> = new Map();
    for (const tier of SCORE_TIERS) {
      buckets.set(tier.name, []);
    }

    for (const property of properties) {
      const { avgScore } = calculatePropertyMetrics(scores[property.id]);

      let tierName = 'Needs Work (0-5.99)';
      if (avgScore !== null) {
        if (avgScore >= 9.0) tierName = 'Wonderful (9.0+)';
        else if (avgScore >= 8.0) tierName = 'Very Good (8.0-8.99)';
        else if (avgScore >= 7.0) tierName = 'Good (7.0-7.99)';
        else if (avgScore >= 6.0) tierName = 'Pleasant (6.0-6.99)';
      }

      buckets.get(tierName)!.push(property.id);
    }

    // Add filter suffix to names
    const suffix = filter === 'kasa' ? ' — Kasa' : filter === 'competitors' ? ' — Competitors' : '';

    return SCORE_TIERS.map(tier => ({
      name: `${tier.name}${suffix}`,
      propertyIds: buckets.get(tier.name) || [],
      isPublic: true,
    }));
  };

  const createAutoGroups = useMutation({
    mutationFn: async (groupDefinitions: GroupDefinition[]) => {
      if (!user) throw new Error('Not authenticated');

      const createdGroups: { name: string; propertyCount: number }[] = [];

      for (const def of groupDefinitions) {
        const { data: group, error: groupError } = await supabase
          .from('groups')
          .insert({ name: def.name, user_id: user.id, is_public: def.isPublic })
          .select()
          .single();

        if (groupError) throw groupError;

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
    createAutoGroups,
  };
}
