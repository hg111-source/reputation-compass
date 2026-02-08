import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProperties } from '@/hooks/useProperties';
import { useLatestKasaSnapshots } from '@/hooks/useKasaSnapshots';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { KasaBenchmarkTab } from '@/components/kasa/KasaBenchmarkTab';

export default function Insights() {
  const { user, loading } = useAuth();
  const { properties } = useProperties();

  // Filter properties that have Kasa data
  const kasaProperties = useMemo(() => {
    return properties.filter(p => p.kasa_url || p.kasa_aggregated_score);
  }, [properties]);

  const kasaPropertyIds = useMemo(() => kasaProperties.map(p => p.id), [kasaProperties]);
  
  // Fetch latest Kasa snapshots
  const { data: kasaSnapshots = {} } = useLatestKasaSnapshots(kasaPropertyIds);

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

        {/* Benchmarking Content */}
        <KasaBenchmarkTab 
          properties={kasaProperties} 
          snapshots={kasaSnapshots}
        />
      </div>
    </DashboardLayout>
  );
}
