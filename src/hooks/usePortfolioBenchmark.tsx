import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type Platform = 'google' | 'tripadvisor' | 'booking' | 'expedia';

interface PlatformDistribution {
  scores: number[];
  avg: number | null;
  count: number;
}

interface PortfolioBenchmark {
  distributions: Record<Platform, PlatformDistribution>;
  totalProperties: number;
}

export function usePortfolioBenchmark() {
  return useQuery({
    queryKey: ['portfolio-benchmark'],
    queryFn: async (): Promise<PortfolioBenchmark> => {
      // Get non-Kasa properties
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id, kasa_url');
      
      if (propError) throw propError;
      
      const nonKasaPropertyIds = properties?.filter(p => !p.kasa_url).map(p => p.id) || [];
      
      if (nonKasaPropertyIds.length === 0) {
        return {
          distributions: {
            google: { scores: [], avg: null, count: 0 },
            tripadvisor: { scores: [], avg: null, count: 0 },
            booking: { scores: [], avg: null, count: 0 },
            expedia: { scores: [], avg: null, count: 0 },
          },
          totalProperties: 0,
        };
      }
      
      // Get latest snapshots for non-Kasa properties
      const { data: snapshots, error: snapError } = await supabase
        .from('source_snapshots')
        .select('property_id, source, normalized_score_0_10, collected_at')
        .in('property_id', nonKasaPropertyIds)
        .in('source', ['google', 'tripadvisor', 'booking', 'expedia'])
        .not('normalized_score_0_10', 'is', null)
        .order('collected_at', { ascending: false });
      
      if (snapError) throw snapError;
      
      // Get latest snapshot per property/platform
      const latestSnapshots = new Map<string, number>();
      snapshots?.forEach(snap => {
        const key = `${snap.property_id}-${snap.source}`;
        if (!latestSnapshots.has(key) && snap.normalized_score_0_10 != null) {
          latestSnapshots.set(key, Number(snap.normalized_score_0_10));
        }
      });
      
      // Build distributions for each platform
      const platforms: Platform[] = ['google', 'tripadvisor', 'booking', 'expedia'];
      const distributions: Record<Platform, PlatformDistribution> = {
        google: { scores: [], avg: null, count: 0 },
        tripadvisor: { scores: [], avg: null, count: 0 },
        booking: { scores: [], avg: null, count: 0 },
        expedia: { scores: [], avg: null, count: 0 },
      };
      
      platforms.forEach(platform => {
        const scores: number[] = [];
        nonKasaPropertyIds.forEach(propId => {
          const score = latestSnapshots.get(`${propId}-${platform}`);
          if (score !== undefined) {
            scores.push(score);
          }
        });
        
        if (scores.length > 0) {
          distributions[platform] = {
            scores: scores.sort((a, b) => a - b),
            avg: scores.reduce((a, b) => a + b, 0) / scores.length,
            count: scores.length,
          };
        }
      });
      
      return {
        distributions,
        totalProperties: nonKasaPropertyIds.length,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Calculate Kasa portfolio OTA averages dynamically from snapshot data
export function useKasaOTAAverages() {
  return useQuery({
    queryKey: ['kasa-ota-averages'],
    queryFn: async (): Promise<Record<string, number>> => {
      // Get Kasa property IDs
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id')
        .or('kasa_url.not.is.null,kasa_aggregated_score.not.is.null');
      
      if (propError) throw propError;
      const kasaIds = properties?.map(p => p.id) || [];
      if (kasaIds.length === 0) return {};

      // Get latest OTA snapshots for Kasa properties
      const { data: snapshots, error: snapError } = await supabase
        .from('source_snapshots')
        .select('property_id, source, normalized_score_0_10, collected_at')
        .in('property_id', kasaIds)
        .in('source', ['google', 'tripadvisor', 'booking', 'expedia'])
        .not('normalized_score_0_10', 'is', null)
        .order('collected_at', { ascending: false });

      if (snapError) throw snapError;

      // Deduplicate: latest per property+platform
      const latest = new Map<string, number>();
      snapshots?.forEach(s => {
        const key = `${s.property_id}-${s.source}`;
        if (!latest.has(key) && s.normalized_score_0_10 != null) {
          latest.set(key, Number(s.normalized_score_0_10));
        }
      });

      // Average by platform
      const platformScores: Record<string, number[]> = {};
      latest.forEach((score, key) => {
        const platform = key.split('-').pop()!;
        if (!platformScores[platform]) platformScores[platform] = [];
        platformScores[platform].push(score);
      });

      const averages: Record<string, number> = {};
      Object.entries(platformScores).forEach(([platform, scores]) => {
        averages[platform] = scores.reduce((a, b) => a + b, 0) / scores.length;
      });

      return averages;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Calculate percentile rank of a score INCLUDING it in the full distribution
// This matches Excel's PERCENTRANK behavior: add the value to the set, then find its rank
export function calculatePercentileInDistribution(score: number, otherScores: number[]): number {
  if (otherScores.length === 0) return 50; // No comparison data, assume median
  
  // Add Kasa's score to the full set (like Excel would)
  const fullSet = [...otherScores, score].sort((a, b) => a - b);
  
  // Count how many values are strictly below this score
  let countBelow = 0;
  for (const s of fullSet) {
    if (s < score) countBelow++;
    else break;
  }
  
  // Percentile rank = (values below) / (total - 1) * 100
  const totalCount = fullSet.length;
  return (countBelow / (totalCount - 1)) * 100;
}
