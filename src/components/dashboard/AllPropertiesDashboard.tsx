import { useState, useMemo } from 'react';
import { ReviewSource } from '@/lib/types';
import { useProperties } from '@/hooks/useProperties';
import { useLatestPropertyScores } from '@/hooks/useSnapshots';
import { useUnifiedRefresh } from '@/hooks/useUnifiedRefresh';
import { GroupScoresTable } from './GroupScoresTable';
import { PlatformBreakdown } from './PlatformBreakdown';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Download, TrendingUp, Building2, Users } from 'lucide-react';
import { exportGroupToCSV } from '@/lib/csv';
import { useToast } from '@/hooks/use-toast';
import { calculatePropertyMetrics, getScoreColor } from '@/lib/scoring';
import { cn } from '@/lib/utils';
import { UnifiedRefreshDialog } from '@/components/properties/UnifiedRefreshDialog';

interface AllPropertiesDashboardProps {
  groupSelector?: React.ReactNode;
}

export function AllPropertiesDashboard({ groupSelector }: AllPropertiesDashboardProps) {
  const { properties, isLoading: propertiesLoading } = useProperties();
  const propertyIds = properties.map(p => p.id);
  const { data: scores = {}, isLoading: scoresLoading } = useLatestPropertyScores(propertyIds);
  const { toast } = useToast();
  const [isRefreshDialogOpen, setIsRefreshDialogOpen] = useState(false);
  
  const {
    isRunning,
    isComplete,
    currentPhase,
    currentPlatform,
    propertyStates,
    refreshAll,
    retryPlatform,
    retryAllFailed,
    getFailedCount,
    setDialogOpen,
  } = useUnifiedRefresh();

  const handleRefreshAll = () => {
    if (properties.length === 0) return;
    setIsRefreshDialogOpen(true);
    setDialogOpen(true);
    refreshAll(properties);
  };

  const handleRefreshDialogChange = (open: boolean) => {
    setIsRefreshDialogOpen(open);
    setDialogOpen(open);
  };

  const handleExport = () => {
    exportGroupToCSV('All Properties', properties, scores as Record<string, Record<ReviewSource, { score: number; count: number; updated: string }>>);
    toast({ title: 'Export complete', description: 'CSV file has been downloaded.' });
  };

  // Calculate portfolio-wide metrics
  const portfolioMetrics = useMemo(() => {
    if (properties.length === 0) {
      return { weightedAvg: null, totalReviews: 0, propertiesWithData: 0 };
    }

    let groupWeightedSum = 0;
    let groupTotalReviews = 0;
    let propertiesWithData = 0;

    for (const property of properties) {
      const propertyScores = scores[property.id];
      const { avgScore, totalReviews } = calculatePropertyMetrics(propertyScores);

      if (avgScore !== null && totalReviews > 0) {
        groupWeightedSum += avgScore * totalReviews;
        groupTotalReviews += totalReviews;
        propertiesWithData++;
      }
    }

    return {
      weightedAvg: groupTotalReviews > 0 ? groupWeightedSum / groupTotalReviews : null,
      totalReviews: groupTotalReviews,
      propertiesWithData,
    };
  }, [properties, scores]);

  if (propertiesLoading || scoresLoading) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span>Loading properties...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <TrendingUp className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold">All Properties</h2>
            {groupSelector}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={properties.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button
            variant="secondary"
            onClick={handleRefreshAll}
            disabled={isRunning || properties.length === 0}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isRunning && 'animate-spin')} />
            Refresh All
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-kasa">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Portfolio Weighted Average
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              'text-4xl font-bold',
              getScoreColor(portfolioMetrics.weightedAvg)
            )}>
              {portfolioMetrics.weightedAvg !== null 
                ? portfolioMetrics.weightedAvg.toFixed(2) 
                : '—'}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">out of 10</p>
          </CardContent>
        </Card>
        <Card className="shadow-kasa">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Reviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Users className="h-6 w-6 text-muted-foreground" />
              <div className="text-4xl font-bold">
                {portfolioMetrics.totalReviews.toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-kasa">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Building2 className="h-6 w-6 text-muted-foreground" />
              <div className="text-4xl font-bold">{properties.length}</div>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {portfolioMetrics.propertiesWithData} with scores
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Breakdown */}
      <PlatformBreakdown 
        properties={properties} 
        scores={scores as Record<string, Record<ReviewSource, { score: number; count: number; updated: string }>>} 
      />

      {/* Properties Table */}
      <GroupScoresTable
        properties={properties}
        scores={scores as Record<string, Record<ReviewSource, { score: number; count: number; updated: string }>>}
        onRefreshProperty={() => {}}
        onRemoveProperty={() => {}}
        isRefreshing={false}
        hideRemoveButton
      />

      {/* Refresh Dialog */}
      <UnifiedRefreshDialog
        open={isRefreshDialogOpen}
        onOpenChange={handleRefreshDialogChange}
        propertyStates={propertyStates}
        currentPhase={currentPhase}
        currentPlatform={currentPlatform}
        onRetry={retryPlatform}
        onRetryAllFailed={retryAllFailed}
        failedCount={getFailedCount()}
        isComplete={isComplete}
        isRunning={isRunning}
      />
    </div>
  );
}
