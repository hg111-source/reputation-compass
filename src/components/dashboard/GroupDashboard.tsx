import { useState, useMemo } from 'react';
import { Group, ReviewSource } from '@/lib/types';
import { useGroupProperties } from '@/hooks/useGroups';
import { useLatestPropertyScores, useGroupSnapshots, useRefreshScores } from '@/hooks/useSnapshots';
import { useUnifiedRefresh } from '@/hooks/useUnifiedRefresh';
import { GroupScoresTable } from './GroupScoresTable';
import { GroupTrendChart } from './GroupTrendChart';
import { SnapshotHistory } from './SnapshotHistory';
import { PlatformBreakdown } from './PlatformBreakdown';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Download, TrendingUp, Building2, Users, Save, Clock } from 'lucide-react';
import { exportGroupToCSV } from '@/lib/csv';
import { useToast } from '@/hooks/use-toast';
import { calculatePropertyMetrics, getScoreColor } from '@/lib/scoring';
import { cn } from '@/lib/utils';
import { UnifiedRefreshDialog } from '@/components/properties/UnifiedRefreshDialog';
import { format } from 'date-fns';

interface GroupDashboardProps {
  group: Group;
  groupSelector?: React.ReactNode;
}

export function GroupDashboard({ group, groupSelector }: GroupDashboardProps) {
  const { properties, isLoading: propertiesLoading, removePropertyFromGroup } = useGroupProperties(group.id);
  const propertyIds = properties.map(p => p.id);
  const { data: scores = {}, isLoading: scoresLoading } = useLatestPropertyScores(propertyIds);
  const { data: groupSnapshots = [] } = useGroupSnapshots(group.id);
  const { refreshProperty, refreshGroup } = useRefreshScores();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshDialogOpen, setIsRefreshDialogOpen] = useState(false);
  
  // Unified refresh hook for actually refreshing all hotels
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

  const handleRefreshProperty = async (propertyId: string) => {
    setIsRefreshing(true);
    try {
      await refreshProperty.mutateAsync(propertyId);
      toast({ title: 'Scores refreshed', description: 'Property scores have been updated.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to refresh scores.' });
    }
    setIsRefreshing(false);
  };

  // Save snapshot only (no refresh)
  const handleSaveSnapshot = async () => {
    if (propertyIds.length === 0) return;
    setIsRefreshing(true);
    try {
      const result = await refreshGroup.mutateAsync({ groupId: group.id, propertyIds });
      toast({ 
        title: 'Group snapshot saved', 
        description: result.weightedAvg !== null 
          ? `Weighted average: ${result.weightedAvg.toFixed(2)} (${result.totalReviews.toLocaleString()} reviews)`
          : 'No score data available'
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save group snapshot.' });
    }
    setIsRefreshing(false);
  };

  // Actually refresh all hotels in the group
  const handleRefreshGroup = () => {
    if (properties.length === 0) return;
    setIsRefreshDialogOpen(true);
    setDialogOpen(true);
    refreshAll(properties);
  };

  const handleRefreshDialogChange = (open: boolean) => {
    setIsRefreshDialogOpen(open);
    setDialogOpen(open);
  };

  const handleRemoveProperty = async (propertyId: string) => {
    try {
      await removePropertyFromGroup.mutateAsync({ groupId: group.id, propertyId });
      toast({ title: 'Property removed', description: 'Property removed from group.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove property.' });
    }
  };

  const handleExport = () => {
    exportGroupToCSV(group.name, properties, scores as Record<string, Record<ReviewSource, { score: number; count: number; updated: string }>>);
    toast({ title: 'Export complete', description: 'CSV file has been downloaded.' });
  };

  // Calculate live group weighted average from current property scores
  // Formula: Σ(hotelWeightedAvg × hotelTotalReviews) / Σ(allTotalReviews)
  const liveGroupMetrics = useMemo(() => {
    if (properties.length === 0) {
      return { weightedAvg: null, totalReviews: 0, propertiesWithData: 0 };
    }

    let groupWeightedSum = 0;
    let groupTotalReviews = 0;
    let propertiesWithData = 0;

    for (const property of properties) {
      const propertyScores = scores[property.id];
      let { avgScore, totalReviews } = calculatePropertyMetrics(propertyScores);

      // Fallback to Kasa fields if no OTA snapshot data
      if (avgScore === null && property.kasa_aggregated_score) {
        avgScore = property.kasa_aggregated_score;
        totalReviews = property.kasa_review_count ?? 0;
      }

      if (avgScore !== null && totalReviews > 0) {
        // Each hotel's weighted avg × its total reviews
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
        <span>Loading group data...</span>
      </div>
    );
  }

  const latestSnapshot = groupSnapshots[0];
  
  return (
    <div className="space-y-8">
      {/* Group Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <TrendingUp className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold">{group.name}</h2>
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
            variant="outline"
            onClick={handleSaveSnapshot}
            disabled={isRefreshing || properties.length === 0}
          >
            <Save className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')} />
            Save Snapshot
          </Button>
          <Button
            variant="secondary"
            onClick={handleRefreshGroup}
            disabled={isRunning || properties.length === 0}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isRunning && 'animate-spin')} />
            Refresh Group
          </Button>
        </div>
      </div>

      {/* Stats Cards - Show live calculated metrics */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="shadow-kasa">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Group Weighted Average
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              'text-4xl font-bold',
              getScoreColor(liveGroupMetrics.weightedAvg)
            )}>
              {liveGroupMetrics.weightedAvg !== null 
                ? liveGroupMetrics.weightedAvg.toFixed(2) 
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
                {liveGroupMetrics.totalReviews.toLocaleString()}
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
              {liveGroupMetrics.propertiesWithData} with scores
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-kasa">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestSnapshot ? (
              <>
                <div className="text-xl font-semibold">
                  {new Date(latestSnapshot.collected_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Score: {latestSnapshot.weighted_score_0_10.toFixed(2)}
                </p>
              </>
            ) : (
              <>
                <div className="text-xl font-semibold text-muted-foreground">No snapshots</div>
                <p className="mt-1 text-sm text-muted-foreground">Click "Refresh All" to save</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Breakdown */}
      <PlatformBreakdown 
        properties={properties} 
        scores={scores as Record<string, Record<ReviewSource, { score: number; count: number; updated: string }>>} 
      />

      {/* Group Trend Chart removed */}

      <GroupScoresTable
        properties={properties}
        scores={scores as Record<string, Record<ReviewSource, { score: number; count: number; updated: string }>>}
        onRefreshProperty={handleRefreshProperty}
        onRemoveProperty={handleRemoveProperty}
        isRefreshing={isRefreshing}
      />

      <SnapshotHistory snapshots={groupSnapshots} type="group" />

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
