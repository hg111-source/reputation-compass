import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProperties } from '@/hooks/useProperties';
import { useLatestKasaSnapshots } from '@/hooks/useKasaSnapshots';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { KasaBenchmarkTab } from '@/components/kasa/KasaBenchmarkTab';
import { ThemeComparisonCard } from '@/components/kasa/ThemeComparisonCard';
import { ExecutiveSummaryCard } from '@/components/kasa/ExecutiveSummaryCard';
import { usePortfolioThemes } from '@/hooks/usePortfolioThemes';
import { usePortfolioBenchmark, calculatePercentileInDistribution } from '@/hooks/usePortfolioBenchmark';

// Kasa's actual portfolio OTA averages
const KASA_OTA_SCORES: Record<string, number> = {
  google: 9.28,
  tripadvisor: 9.22,
  booking: 8.32,
  expedia: 8.69,
};

const PLATFORM_NAMES: Record<string, string> = {
  google: 'Google',
  tripadvisor: 'TripAdvisor',
  booking: 'Booking',
  expedia: 'Expedia',
};

export default function Insights() {
  const { user, loading } = useAuth();
  const { properties } = useProperties();

  const kasaProperties = useMemo(() => {
    return properties.filter(p => p.kasa_url || p.kasa_aggregated_score);
  }, [properties]);

  const compProperties = useMemo(() => {
    return properties.filter(p => !p.kasa_url && !p.kasa_aggregated_score);
  }, [properties]);

  const kasaPropertyIds = useMemo(() => kasaProperties.map(p => p.id), [kasaProperties]);
  const compPropertyIds = useMemo(() => compProperties.map(p => p.id), [compProperties]);
  
  const { data: kasaSnapshots = {} } = useLatestKasaSnapshots(kasaPropertyIds);

  const { data: kasaThemes, isLoading: kasaThemesLoading } = usePortfolioThemes(kasaPropertyIds, 'kasa');
  const { data: compThemes, isLoading: compThemesLoading } = usePortfolioThemes(compPropertyIds, 'comps');
  const { data: benchmark } = usePortfolioBenchmark();

  const themesLoading = kasaThemesLoading || compThemesLoading;

  // Compute portfolio metrics for executive summary
  const portfolioMetrics = useMemo(() => {
    const scores: number[] = [];
    let totalReviews = 0;

    kasaProperties.forEach(p => {
      const snapshot = kasaSnapshots[p.id];
      const score5 = snapshot?.score_raw ?? p.kasa_aggregated_score;
      if (score5 !== null && score5 !== undefined) {
        scores.push(Number(score5) * 2);
      }
      totalReviews += snapshot?.review_count ?? p.kasa_review_count ?? 0;
    });

    if (scores.length === 0) return null;

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const veryGoodPlus = scores.filter(s => s >= 8.0).length;

    return {
      avgScore,
      totalProperties: scores.length,
      totalReviews,
      veryGoodPlusPercent: Math.round((veryGoodPlus / scores.length) * 100),
      exceptionalCount: scores.filter(s => s >= 9.5).length,
      belowGoodCount: scores.filter(s => s < 7.0).length,
    };
  }, [kasaProperties, kasaSnapshots]);

  // OTA benchmarks
  const otaBenchmarks = useMemo(() => {
    if (!benchmark?.distributions) return [];
    return (['google', 'tripadvisor', 'booking', 'expedia'] as const).map(platform => {
      const dist = benchmark.distributions[platform];
      const kasaScore = KASA_OTA_SCORES[platform];
      const percentile = dist?.scores?.length
        ? calculatePercentileInDistribution(kasaScore, dist.scores)
        : null;
      return { platform: PLATFORM_NAMES[platform], kasaScore, percentile };
    });
  }, [benchmark]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">KasaSights</h1>
          <p className="mt-2 text-muted-foreground">
            Portfolio benchmarking and executive insights
          </p>
        </div>

        {/* 1. Comprehensive Executive Briefing — top of page */}
        <ExecutiveSummaryCard
          kasaThemes={kasaThemes}
          compThemes={compThemes}
          portfolioMetrics={portfolioMetrics}
          otaBenchmarks={otaBenchmarks}
          isLoading={themesLoading}
        />

        {/* 2. Theme Comparison */}
        <ThemeComparisonCard
          kasaThemes={kasaThemes}
          compThemes={compThemes}
          isLoading={themesLoading}
        />

        {/* 3. SWOT, Channel Benchmarks, Geographic, Score Distribution */}
        <KasaBenchmarkTab 
          properties={kasaProperties} 
          snapshots={kasaSnapshots}
        />
      </div>
    </DashboardLayout>
  );
}
