import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Property, ReviewSource } from '@/lib/types';
import { REVIEW_SOURCES, SOURCE_LABELS, getScoreColor, formatScore } from '@/lib/scoring';
import { cn } from '@/lib/utils';
import googleLogo from '@/assets/logos/google.svg';
import tripadvisorLogo from '@/assets/logos/tripadvisor.png';
import bookingLogo from '@/assets/logos/booking.png';
import expediaLogo from '@/assets/logos/expedia.png';

const platformLogos: Partial<Record<ReviewSource, string>> = {
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
  const { platformMetrics, overallMetrics, hasKasaData } = useMemo(() => {
    const metrics: PlatformMetric[] = [];
    let overallPoints = 0;
    let overallReviews = 0;

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

      overallPoints += totalPoints;
      overallReviews += totalReviews;

      metrics.push({
        platform,
        avgScore: totalReviews > 0 ? totalPoints / totalReviews : null,
        totalReviews,
        propertyCount,
      });
    }

    // Calculate Kasa platform metrics from property fields
    let kasaPoints = 0;
    let kasaReviews = 0;
    let kasaCount = 0;

    for (const property of properties) {
      if (property.kasa_aggregated_score && property.kasa_review_count && property.kasa_review_count > 0) {
        const normalizedScore = (property.kasa_aggregated_score / 5) * 10;
        kasaPoints += normalizedScore * property.kasa_review_count;
        kasaReviews += property.kasa_review_count;
        kasaCount++;
      }
    }

    if (kasaCount > 0) {
      metrics.push({
        platform: 'kasa' as ReviewSource,
        avgScore: kasaReviews > 0 ? kasaPoints / kasaReviews : null,
        totalReviews: kasaReviews,
        propertyCount: kasaCount,
      });
      overallPoints += kasaPoints;
      overallReviews += kasaReviews;
    }

    return {
      platformMetrics: metrics,
      overallMetrics: {
        avgScore: overallReviews > 0 ? overallPoints / overallReviews : null,
        totalReviews: overallReviews,
      },
      hasKasaData: kasaCount > 0,
    };
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {platformMetrics
            .filter(metric => metric.totalReviews > 0 && metric.platform !== 'kasa')
            .map(metric => (
            <div
              key={metric.platform}
              className="flex flex-col items-center p-4 rounded-xl bg-muted/30 text-center"
            >
              {platformLogos[metric.platform] ? (
                <img
                  src={platformLogos[metric.platform]}
                  alt={SOURCE_LABELS[metric.platform]}
                  className="h-6 w-6 object-contain mb-2"
                />
              ) : (
                <div className="h-6 w-6 flex items-center justify-center mb-2">
                  <span className="text-sm font-bold text-primary">K</span>
                </div>
              )}
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
                ({metric.totalReviews.toLocaleString()})
              </p>
            </div>
          ))}
          {/* Overall Group Average */}
          <div className="flex flex-col items-center p-4 rounded-xl bg-primary/10 border border-primary/20 text-center">
            <div className="h-6 w-6 flex items-center justify-center mb-2">
              <span className="text-lg font-bold text-primary">Σ</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium mb-1">
              Overall
            </p>
            <span className={cn(
              'text-2xl font-bold',
              getScoreColor(overallMetrics.avgScore)
            )}>
              {overallMetrics.avgScore !== null ? formatScore(overallMetrics.avgScore) : '—'}
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              ({overallMetrics.totalReviews.toLocaleString()})
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
