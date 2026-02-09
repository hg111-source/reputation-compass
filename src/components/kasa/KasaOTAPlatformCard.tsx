import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { usePortfolioBenchmark, useKasaOTAAverages, calculatePercentileInDistribution } from '@/hooks/usePortfolioBenchmark';

// Import platform logos
import googleLogo from '@/assets/logos/google.svg';
import tripadvisorLogo from '@/assets/logos/tripadvisor.png';
import bookingLogo from '@/assets/logos/booking.png';
import expediaLogo from '@/assets/logos/expedia.png';

type Platform = 'google' | 'tripadvisor' | 'booking' | 'expedia';

// Platform order to match Properties table
const PLATFORM_ORDER: Platform[] = ['google', 'tripadvisor', 'booking', 'expedia'];

// Platform display info
const PLATFORM_INFO: Record<Platform, { name: string; logo: string }> = {
  google: { name: 'Google', logo: googleLogo },
  tripadvisor: { name: 'TripAdvisor', logo: tripadvisorLogo },
  booking: { name: 'Booking', logo: bookingLogo },
  expedia: { name: 'Expedia', logo: expediaLogo },
};

// Get tier styling based on percentile
function getPercentileTier(percentile: number): { color: string; bgColor: string } {
  if (percentile >= 90) return { color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' };
  if (percentile >= 75) return { color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' };
  if (percentile >= 50) return { color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' };
  return { color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' };
}

export function KasaOTAPlatformCard() {
  const { data: benchmark, isLoading: benchmarkLoading, error } = usePortfolioBenchmark();
  const { data: kasaOTA, isLoading: kasaLoading } = useKasaOTAAverages();

  const isLoading = benchmarkLoading || kasaLoading;

  const platformData = useMemo(() => {
    if (!benchmark || !benchmark.distributions || !kasaOTA) return [];
    
    return PLATFORM_ORDER.map(platform => {
      const kasaData = kasaOTA[platform];
      const kasaScore = kasaData?.score ?? null;
      const dist = benchmark.distributions?.[platform];
      
      if (!dist || kasaScore === null) {
        return {
          platform,
          ...PLATFORM_INFO[platform],
          kasaScore,
          kasaReviews: kasaData?.totalReviews ?? 0,
          kasaPropertyCount: kasaData?.propertyCount ?? 0,
          portfolioAvg: dist?.avg ?? null,
          portfolioCount: dist?.count ?? 0,
          percentile: null,
        };
      }
      
      const percentile = dist.scores && dist.scores.length > 0
        ? calculatePercentileInDistribution(kasaScore, dist.scores)
        : null;
      
      return {
        platform,
        ...PLATFORM_INFO[platform],
        kasaScore,
        kasaReviews: kasaData?.totalReviews ?? 0,
        kasaPropertyCount: kasaData?.propertyCount ?? 0,
        portfolioAvg: dist.avg,
        portfolioCount: dist.count,
        percentile,
      };
    });
  }, [benchmark, kasaOTA]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kasa Portfolio Avg Score & Percentile by Channel</CardTitle>
          <CardDescription>Loading benchmark data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kasa Portfolio Avg Score & Percentile by Channel</CardTitle>
          <CardDescription>Error loading benchmark data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load benchmark data. Please refresh the page.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kasa Portfolio Avg Score & Percentile by Channel</CardTitle>
        <CardDescription>
          Weighted OTA averages benchmarked against {benchmark?.totalProperties || 0} competitor properties
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {platformData.map((data) => {
            const tier = data.percentile !== null 
              ? getPercentileTier(data.percentile) 
              : { color: 'text-muted-foreground', bgColor: 'bg-muted/50' };
            const topPercent = data.percentile !== null ? Math.max(1, Math.round(100 - data.percentile)) : null;
            
            return (
              <div 
                key={data.platform} 
                className={cn('p-4 rounded-lg border', tier.bgColor)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <img src={data.logo} alt={data.name} className="h-5 w-5 object-contain mix-blend-multiply dark:mix-blend-normal" />
                  <p className="text-sm font-medium text-muted-foreground">{data.name}</p>
                </div>
                <p className={cn('text-xl font-bold', tier.color)}>
                  {data.kasaScore !== null ? data.kasaScore.toFixed(2) : '—'}
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  /10 • {data.kasaReviews.toLocaleString()} reviews
                </p>
                {topPercent !== null ? (
                  <Badge variant="outline" className={cn('text-sm font-semibold px-3 py-1', tier.color)}>
                    Top {topPercent}%
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    No data
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          * Percentile rank within full portfolio of competitor properties
        </p>
      </CardContent>
    </Card>
  );
}
