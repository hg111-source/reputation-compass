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

// Kasa's actual portfolio OTA averages (from master data)
const KASA_OTA_SCORES: Record<Platform, number> = {
  google: 9.28,      // 4.64/5 × 2
  tripadvisor: 9.22, // 4.61/5 × 2
  booking: 8.32,     // Already /10
  expedia: 8.69,     // Already /10
};

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
    if (!benchmark?.distributions) return [];
    
    return PLATFORM_ORDER.map(platform => {
      const kasaScore = KASA_OTA_SCORES[platform];
      const dist = benchmark.distributions[platform];
      
      if (!dist) {
        return {
          platform,
          ...PLATFORM_INFO[platform],
          kasaScore,
          portfolioAvg: null,
          portfolioCount: 0,
          percentile: null,
        };
      }
      
      const percentile = dist.scores.length > 0
        ? calculatePercentileInDistribution(kasaScore, dist.scores)
        : null;
      
      return {
        platform,
        ...PLATFORM_INFO[platform],
        kasaScore,
        portfolioAvg: dist.avg,
        portfolioCount: dist.count,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kasa Portfolio Avg Score & Percentile by Channel</CardTitle>
        <CardDescription>
          Kasa OTA averages benchmarked against {benchmark?.totalProperties || 0} properties in All Properties
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
                className={cn('p-4 rounded-lg border text-center', tier.bgColor)}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <img src={data.logo} alt={data.name} className="h-5 w-5" />
                  <p className="text-sm font-medium text-muted-foreground">{data.name}</p>
                </div>
                <p className={cn('text-xl font-bold', tier.color)}>
                  {data.kasaScore.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  /10 • Portfolio avg: {data.portfolioAvg?.toFixed(2) || 'N/A'}
                </p>
                {topPercent !== null ? (
                  <Badge variant="outline" className={cn('text-sm font-semibold px-3 py-1', tier.color)}>
                    Top {topPercent}%
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    No data ({data.portfolioCount} props)
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          * Percentile calculated from {benchmark?.totalProperties || 0} non-Kasa properties across your portfolio
        </p>
      </CardContent>
    </Card>
  );
}
