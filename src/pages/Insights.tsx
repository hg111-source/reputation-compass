import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProperties } from '@/hooks/useProperties';
import { useLatestKasaSnapshots } from '@/hooks/useKasaSnapshots';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { KasaBenchmarkTab } from '@/components/kasa/KasaBenchmarkTab';
import { PortfolioThemesCard } from '@/components/kasa/PortfolioThemesCard';
import { usePortfolioThemes } from '@/hooks/usePortfolioThemes';

export default function Insights() {
  const { user, loading } = useAuth();
  const { properties } = useProperties();

  // Filter properties that have Kasa data
  const kasaProperties = useMemo(() => {
    return properties.filter(p => p.kasa_url || p.kasa_aggregated_score);
  }, [properties]);

  // Comp properties (non-Kasa)
  const compProperties = useMemo(() => {
    return properties.filter(p => !p.kasa_url && !p.kasa_aggregated_score);
  }, [properties]);

  const kasaPropertyIds = useMemo(() => kasaProperties.map(p => p.id), [kasaProperties]);
  const compPropertyIds = useMemo(() => compProperties.map(p => p.id), [compProperties]);
  
  // Fetch latest Kasa snapshots
  const { data: kasaSnapshots = {} } = useLatestKasaSnapshots(kasaPropertyIds);

  // Portfolio-wide AI themes
  const { data: kasaThemes, isLoading: kasaThemesLoading } = usePortfolioThemes(kasaPropertyIds, 'kasa');
  const { data: compThemes, isLoading: compThemesLoading } = usePortfolioThemes(compPropertyIds, 'comps');

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
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">KasaSights</h1>
          <p className="mt-2 text-muted-foreground">
            Portfolio benchmarking and executive insights
          </p>
        </div>

        {/* Portfolio-wide AI Theme Analysis */}
        <div className="space-y-6">
          <PortfolioThemesCard
            title="Kasa Portfolio — Guest Sentiment"
            description="Aggregated AI themes across all Kasa properties"
            data={kasaThemes}
            isLoading={kasaThemesLoading}
            accentColor="teal"
          />
          <PortfolioThemesCard
            title="Comp Set — Guest Sentiment"
            description="Aggregated AI themes across all competitor properties"
            data={compThemes}
            isLoading={compThemesLoading}
            accentColor="blue"
          />
        </div>

        {/* Benchmarking Content */}
        <KasaBenchmarkTab 
          properties={kasaProperties} 
          snapshots={kasaSnapshots}
        />
      </div>
    </DashboardLayout>
  );
}
