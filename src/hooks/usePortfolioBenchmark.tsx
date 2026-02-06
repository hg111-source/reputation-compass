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
  // This gives the position in the distribution (0-100)
  const totalCount = fullSet.length;
  return (countBelow / (totalCount - 1)) * 100;
}
