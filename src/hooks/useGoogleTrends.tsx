import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TrendDirection = 'up' | 'down' | 'flat' | 'none';

export interface GoogleTrendData {
  latestScore: number | null;
  latestCount: number | null;
  latestUpdated: string | null;
  priorScore: number | null;
  change30d: number | null;
  trend: TrendDirection;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TREND_THRESHOLD = 0.05;

function computeTrend(change: number | null): TrendDirection {
  if (change === null) return 'none';
  if (change >= TREND_THRESHOLD) return 'up';
  if (change <= -TREND_THRESHOLD) return 'down';
  return 'flat';
}

export function useGoogleTrends(propertyIds: string[]) {
  return useQuery({
    queryKey: ['google-trends', propertyIds],
    queryFn: async () => {
      if (propertyIds.length === 0) return {};

      const results: Record<string, GoogleTrendData> = {};

      // Fetch all Google snapshots for these properties within last 90 days
      // to minimize queries - we'll compute latest and prior in memory
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: snapshots, error } = await supabase
        .from('source_snapshots')
        .select('property_id, normalized_score_0_10, review_count, collected_at')
        .in('property_id', propertyIds)
        .eq('source', 'google')
        .gte('collected_at', ninetyDaysAgo)
        .order('collected_at', { ascending: false });

      if (error) throw error;

      // Group snapshots by property
      const snapshotsByProperty: Record<string, typeof snapshots> = {};
      for (const snapshot of snapshots || []) {
        if (!snapshotsByProperty[snapshot.property_id]) {
          snapshotsByProperty[snapshot.property_id] = [];
        }
        snapshotsByProperty[snapshot.property_id].push(snapshot);
      }

      // Compute trends for each property
      for (const propertyId of propertyIds) {
        const propertySnapshots = snapshotsByProperty[propertyId] || [];
        
        if (propertySnapshots.length === 0) {
          results[propertyId] = {
            latestScore: null,
            latestCount: null,
            latestUpdated: null,
            priorScore: null,
            change30d: null,
            trend: 'none',
          };
          continue;
        }

        // Snapshots are already sorted desc by collected_at
        const latest = propertySnapshots[0];
        const latestDate = new Date(latest.collected_at);
        const targetDate = new Date(latestDate.getTime() - THIRTY_DAYS_MS);

        // Find the most recent snapshot that is at least 30 days older
        let priorSnapshot = null;
        for (const snapshot of propertySnapshots) {
          const snapshotDate = new Date(snapshot.collected_at);
          if (snapshotDate <= targetDate) {
            priorSnapshot = snapshot;
            break;
          }
        }

        const change30d = priorSnapshot
          ? latest.normalized_score_0_10 - priorSnapshot.normalized_score_0_10
          : null;

        results[propertyId] = {
          latestScore: latest.normalized_score_0_10,
          latestCount: latest.review_count,
          latestUpdated: latest.collected_at,
          priorScore: priorSnapshot?.normalized_score_0_10 ?? null,
          change30d,
          trend: computeTrend(change30d),
        };
      }

      return results;
    },
    enabled: propertyIds.length > 0,
  });
}

export function formatChange(change: number | null): string {
  if (change === null) return '—';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}`;
}
