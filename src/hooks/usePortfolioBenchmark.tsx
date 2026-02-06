import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type Platform = 'google' | 'tripadvisor' | 'booking' | 'expedia';

interface PlatformStats {
  avg: number | null;
  count: number;
  scores: number[]; // For percentile calculation
}

interface PortfolioBenchmark {
  kasa: Record<Platform, PlatformStats>;
  nonKasa: Record<Platform, PlatformStats>;
  kasaPropertyCount: number;
  nonKasaPropertyCount: number;
}

export function usePortfolioBenchmark() {
  return useQuery({
    queryKey: ['portfolio-benchmark'],
    queryFn: async (): Promise<PortfolioBenchmark> => {
      // Get all properties to separate Kasa vs non-Kasa
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id, kasa_url');
      
      if (propError) throw propError;
      
      const kasaPropertyIds = properties?.filter(p => p.kasa_url).map(p => p.id) || [];
      const nonKasaPropertyIds = properties?.filter(p => !p.kasa_url).map(p => p.id) || [];
      
      // Get latest snapshots for each property/platform combination
      const { data: snapshots, error: snapError } = await supabase
        .from('source_snapshots')
        .select('property_id, source, normalized_score_0_10, collected_at')
        .in('source', ['google', 'tripadvisor', 'booking', 'expedia'])
        .not('normalized_score_0_10', 'is', null)
        .order('collected_at', { ascending: false });
      
      if (snapError) throw snapError;
      
      // Get latest snapshot per property/platform
      const latestSnapshots = new Map<string, typeof snapshots[0]>();
      snapshots?.forEach(snap => {
        const key = `${snap.property_id}-${snap.source}`;
        if (!latestSnapshots.has(key)) {
          latestSnapshots.set(key, snap);
        }
      });
      
      // Calculate stats for each platform
      const platforms: Platform[] = ['google', 'tripadvisor', 'booking', 'expedia'];
      
      const calculateStats = (propertyIds: string[]): Record<Platform, PlatformStats> => {
        const stats: Record<Platform, PlatformStats> = {
          google: { avg: null, count: 0, scores: [] },
          tripadvisor: { avg: null, count: 0, scores: [] },
          booking: { avg: null, count: 0, scores: [] },
          expedia: { avg: null, count: 0, scores: [] },
        };
        
        platforms.forEach(platform => {
          const scores: number[] = [];
          propertyIds.forEach(propId => {
            const snap = latestSnapshots.get(`${propId}-${platform}`);
            if (snap?.normalized_score_0_10 != null) {
              scores.push(Number(snap.normalized_score_0_10));
            }
          });
          
          if (scores.length > 0) {
            stats[platform] = {
              avg: scores.reduce((a, b) => a + b, 0) / scores.length,
              count: scores.length,
              scores: scores.sort((a, b) => a - b),
            };
          }
        });
        
        return stats;
      };
      
      return {
        kasa: calculateStats(kasaPropertyIds),
        nonKasa: calculateStats(nonKasaPropertyIds),
        kasaPropertyCount: kasaPropertyIds.length,
        nonKasaPropertyCount: nonKasaPropertyIds.length,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Calculate percentile of a score within a distribution
export function calculatePercentileInDistribution(score: number, sortedScores: number[]): number {
  if (sortedScores.length === 0) return 0;
  
  let count = 0;
  for (const s of sortedScores) {
    if (s < score) count++;
    else break;
  }
  
  return (count / sortedScores.length) * 100;
}
