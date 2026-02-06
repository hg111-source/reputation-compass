import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getScoreColor } from '@/lib/scoring';

// Industry benchmark data (percentiles: 50, 75, 90, 95, 99)
const INDUSTRY_BENCHMARKS = {
  google: { name: 'Google', values: [8.20, 8.40, 8.80, 9.00, 9.34] },
  booking: { name: 'Booking', values: [8.00, 8.40, 8.60, 8.80, 9.10] },
  expedia: { name: 'Expedia', values: [8.40, 8.80, 9.00, 9.20, 9.55] },
  tripadvisor: { name: 'TripAdvisor', values: [8.34, 8.76, 9.00, 9.24, 9.60] },
};

// Kasa's actual portfolio averages (hardcoded from master data)
const KASA_OTA_SCORES = {
  google: 9.28,      // 4.64/5 × 2
  booking: 8.32,     // Already /10
  expedia: 8.69,     // Already /10
  tripadvisor: 9.22, // 4.61/5 × 2
};

// Calculate percentile rank for a score against benchmark values
function calculatePercentile(score: number, benchmarkValues: number[]): number {
  const [p50, p75, p90, p95, p99] = benchmarkValues;
  
  if (score >= p99) return 99;
  if (score >= p95) return 95 + (score - p95) / (p99 - p95) * 4;
  if (score >= p90) return 90 + (score - p90) / (p95 - p90) * 5;
  if (score >= p75) return 75 + (score - p75) / (p90 - p75) * 15;
  if (score >= p50) return 50 + (score - p50) / (p75 - p50) * 25;
  return Math.max(0, 50 * (score / p50));
}

// Get tier styling based on percentile
function getPercentileTier(percentile: number): { color: string; bgColor: string } {
  if (percentile >= 90) return { color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' };
  if (percentile >= 75) return { color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' };
  if (percentile >= 50) return { color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' };
  return { color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' };
}

export function KasaOTAPlatformCard() {
  const platformData = useMemo(() => {
    return [
      {
        key: 'google',
        name: 'Google',
        score: KASA_OTA_SCORES.google,
        percentile: calculatePercentile(KASA_OTA_SCORES.google, INDUSTRY_BENCHMARKS.google.values),
      },
      {
        key: 'booking',
        name: 'Booking',
        score: KASA_OTA_SCORES.booking,
        percentile: calculatePercentile(KASA_OTA_SCORES.booking, INDUSTRY_BENCHMARKS.booking.values),
      },
      {
        key: 'expedia',
        name: 'Expedia',
        score: KASA_OTA_SCORES.expedia,
        percentile: calculatePercentile(KASA_OTA_SCORES.expedia, INDUSTRY_BENCHMARKS.expedia.values),
      },
      {
        key: 'tripadvisor',
        name: 'TripAdvisor',
        score: KASA_OTA_SCORES.tripadvisor,
        percentile: calculatePercentile(KASA_OTA_SCORES.tripadvisor, INDUSTRY_BENCHMARKS.tripadvisor.values),
      },
    ];
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kasa Portfolio by Platform</CardTitle>
        <CardDescription>Average scores across OTA review platforms (manual input)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {platformData.map((platform) => {
            const tier = getPercentileTier(platform.percentile);
            const topPercent = Math.round(100 - platform.percentile);
            
            return (
              <div 
                key={platform.key} 
                className={cn('p-4 rounded-lg border text-center', tier.bgColor)}
              >
                <p className="text-sm font-medium text-muted-foreground mb-1">{platform.name}</p>
                <p className={cn('text-2xl font-bold', tier.color)}>{platform.score.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">/10 scale</p>
                <Badge variant="outline" className={cn('mt-2 text-xs', tier.color)}>
                  Top {topPercent}%
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
