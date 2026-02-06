import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Import platform logos
import googleLogo from '@/assets/logos/google.svg';
import tripadvisorLogo from '@/assets/logos/tripadvisor.svg';
import bookingLogo from '@/assets/logos/booking.svg';
import expediaLogo from '@/assets/logos/expedia.svg';

// Industry benchmark data (percentiles: 50, 75, 90, 95, 99)
const INDUSTRY_BENCHMARKS = {
  google: { name: 'Google', values: [8.20, 8.40, 8.80, 9.00, 9.34] },
  tripadvisor: { name: 'TripAdvisor', values: [8.34, 8.76, 9.00, 9.24, 9.60] },
  booking: { name: 'Booking', values: [8.00, 8.40, 8.60, 8.80, 9.10] },
  expedia: { name: 'Expedia', values: [8.40, 8.80, 9.00, 9.20, 9.55] },
};

// Kasa's actual portfolio averages (hardcoded from master data)
const KASA_OTA_SCORES = {
  google: 9.28,      // 4.64/5 × 2
  tripadvisor: 9.22, // 4.61/5 × 2
  booking: 8.32,     // Already /10
  expedia: 8.69,     // Already /10
};

// Platform order to match Properties table
const PLATFORM_ORDER: Array<keyof typeof KASA_OTA_SCORES> = ['google', 'tripadvisor', 'booking', 'expedia'];

// Platform logos mapping
const PLATFORM_LOGOS: Record<string, string> = {
  google: googleLogo,
  tripadvisor: tripadvisorLogo,
  booking: bookingLogo,
  expedia: expediaLogo,
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

interface KasaOTAPlatformCardProps {
  propertyCount: number;
  lastUpdated?: Date;
}

export function KasaOTAPlatformCard({ propertyCount, lastUpdated }: KasaOTAPlatformCardProps) {
  const platformData = useMemo(() => {
    return PLATFORM_ORDER.map(key => {
      const benchmark = INDUSTRY_BENCHMARKS[key];
      const score = KASA_OTA_SCORES[key];
      return {
        key,
        name: benchmark.name,
        score,
        percentile: calculatePercentile(score, benchmark.values),
        logo: PLATFORM_LOGOS[key],
      };
    });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kasa Portfolio Avg Score & Percentile by Channel</CardTitle>
        <CardDescription>How Kasa compares to industry benchmarks across OTA platforms</CardDescription>
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
                <div className="flex items-center justify-center gap-2 mb-2">
                  <img src={platform.logo} alt={platform.name} className="h-5 w-5" />
                  <p className="text-sm font-medium text-muted-foreground">{platform.name}</p>
                </div>
                <p className={cn('text-xl font-bold', tier.color)}>{platform.score.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mb-2">/10 scale</p>
                <Badge variant="outline" className={cn('text-sm font-semibold px-3 py-1', tier.color)}>
                  Top {topPercent}%
                </Badge>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          * Based on {propertyCount} Kasa properties
          {lastUpdated && ` • Last updated ${lastUpdated.toLocaleDateString()}`}
        </p>
      </CardContent>
    </Card>
  );
}
