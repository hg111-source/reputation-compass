import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Property, ReviewSource } from '@/lib/types';
import { REVIEW_SOURCES, SOURCE_LABELS, getScoreColor, formatScore } from '@/lib/scoring';
import { cn } from '@/lib/utils';
import googleLogo from '@/assets/logos/google.svg';
import tripadvisorLogo from '@/assets/logos/tripadvisor.png';
import bookingLogo from '@/assets/logos/booking.png';
import expediaLogo from '@/assets/logos/expedia.png';

const platformLogos: Record<ReviewSource, string> = {
  google: googleLogo,
  tripadvisor: tripadvisorLogo,
  booking: bookingLogo,
  expedia: expediaLogo,
};

interface PlatformBreakdownProps {
  properties: Property[];
  scores: Record<string, Record<ReviewSource, { score: number; count: number; updated: string }>>;
}

interface PlatformMetric {
  platform: ReviewSource;
  avgScore: number | null;
  totalReviews: number;
  propertyCount: number;
}

export function PlatformBreakdown({ properties, scores }: PlatformBreakdownProps) {
  const platformMetrics = useMemo(() => {
    const metrics: PlatformMetric[] = [];

    for (const platform of REVIEW_SOURCES) {
      let totalPoints = 0;
      let totalReviews = 0;
      let propertyCount = 0;

      for (const property of properties) {
        const propertyScores = scores[property.id];
        const platformData = propertyScores?.[platform];

        if (platformData && platformData.score > 0 && platformData.count > 0) {
          totalPoints += platformData.score * platformData.count;
          totalReviews += platformData.count;
          propertyCount++;
        }
      }

      metrics.push({
        platform,
        avgScore: totalReviews > 0 ? totalPoints / totalReviews : null,
        totalReviews,
        propertyCount,
      });
    }

    return metrics;
  }, [properties, scores]);

  return (
    <Card className="shadow-kasa">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Platform Breakdown</CardTitle>
        <p className="text-sm text-muted-foreground">
          Group weighted average by platform
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {platformMetrics.map(metric => (
            <div
              key={metric.platform}
              className="flex flex-col items-center p-4 rounded-xl bg-muted/30 text-center"
            >
              <img
                src={platformLogos[metric.platform]}
                alt={SOURCE_LABELS[metric.platform]}
                className="h-6 w-6 object-contain mb-2"
              />
              <p className="text-xs text-muted-foreground font-medium mb-1">
                {SOURCE_LABELS[metric.platform]}
              </p>
              <span className={cn(
                'text-2xl font-bold',
                getScoreColor(metric.avgScore)
              )}>
                {metric.avgScore !== null ? formatScore(metric.avgScore) : '—'}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                {metric.totalReviews.toLocaleString()} reviews
              </p>
              <p className="text-xs text-muted-foreground">
                {metric.propertyCount} {metric.propertyCount === 1 ? 'property' : 'properties'}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
