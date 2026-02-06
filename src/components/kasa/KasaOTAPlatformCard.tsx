import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { usePortfolioBenchmark, calculatePercentileInDistribution } from '@/hooks/usePortfolioBenchmark';

// Import platform logos
import googleLogo from '@/assets/logos/google.svg';
import tripadvisorLogo from '@/assets/logos/tripadvisor.svg';
import bookingLogo from '@/assets/logos/booking.svg';
import expediaLogo from '@/assets/logos/expedia.svg';

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
  const { data: benchmark, isLoading } = usePortfolioBenchmark();

  const platformData = useMemo(() => {
    if (!benchmark) return [];
    
    return PLATFORM_ORDER.map(platform => {
      const kasaStats = benchmark.kasa[platform];
      const nonKasaStats = benchmark.nonKasa[platform];
      
      const percentile = kasaStats.avg !== null && nonKasaStats.scores.length > 0
        ? calculatePercentileInDistribution(kasaStats.avg, nonKasaStats.scores)
        : null;
      
      return {
        platform,
        ...PLATFORM_INFO[platform],
        kasaAvg: kasaStats.avg,
        kasaCount: kasaStats.count,
        nonKasaAvg: nonKasaStats.avg,
        nonKasaCount: nonKasaStats.count,
        percentile,
      };
    });
  }, [benchmark]);

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

  const hasData = platformData.some(p => p.kasaAvg !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kasa Portfolio Avg Score & Percentile by Channel</CardTitle>
        <CardDescription>
          Kasa properties benchmarked against {benchmark?.nonKasaPropertyCount || 0} non-Kasa properties
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-center text-muted-foreground py-8">
            No OTA data available for Kasa properties. Refresh OTA scores to enable benchmarking.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {platformData.map((data) => {
                const tier = data.percentile !== null 
                  ? getPercentileTier(data.percentile) 
                  : { color: 'text-muted-foreground', bgColor: 'bg-muted/50' };
                const topPercent = data.percentile !== null ? Math.round(100 - data.percentile) : null;
                
                return (
                  <div 
                    key={data.platform} 
                    className={cn('p-4 rounded-lg border text-center', tier.bgColor)}
                  >
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <img src={data.logo} alt={data.name} className="h-5 w-5" />
                      <p className="text-sm font-medium text-muted-foreground">{data.name}</p>
                    </div>
                    {data.kasaAvg !== null ? (
                      <>
                        <p className={cn('text-xl font-bold', tier.color)}>
                          {data.kasaAvg.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground mb-2">
                          /10 • {data.kasaCount} properties
                        </p>
                        {topPercent !== null && (
                          <Badge variant="outline" className={cn('text-sm font-semibold px-3 py-1', tier.color)}>
                            Top {topPercent}%
                          </Badge>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">No data</p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">
              * Percentile based on {benchmark?.nonKasaPropertyCount || 0} non-Kasa properties in your portfolio
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
