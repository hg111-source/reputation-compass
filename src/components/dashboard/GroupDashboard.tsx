import { useState } from 'react';
import { Group, ReviewSource } from '@/lib/types';
import { useGroupProperties } from '@/hooks/useGroups';
import { useLatestPropertyScores, useGroupSnapshots, useRefreshScores } from '@/hooks/useSnapshots';
import { GroupScoresTable } from './GroupScoresTable';
import { GroupTrendChart } from './GroupTrendChart';
import { SnapshotHistory } from './SnapshotHistory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Download, TrendingUp, Building2 } from 'lucide-react';
import { exportGroupToCSV } from '@/lib/csv';
import { useToast } from '@/hooks/use-toast';

interface GroupDashboardProps {
  group: Group;
}

export function GroupDashboard({ group }: GroupDashboardProps) {
  const { properties, isLoading: propertiesLoading, removePropertyFromGroup } = useGroupProperties(group.id);
  const propertyIds = properties.map(p => p.id);
  const { data: scores = {}, isLoading: scoresLoading } = useLatestPropertyScores(propertyIds);
  const { data: groupSnapshots = [] } = useGroupSnapshots(group.id);
  const { refreshProperty, refreshGroup } = useRefreshScores();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const handleRefreshGroup = async () => {
    if (propertyIds.length === 0) return;
    setIsRefreshing(true);
    try {
      await refreshGroup.mutateAsync({ groupId: group.id, propertyIds });
      toast({ title: 'Group refreshed', description: 'All property scores have been updated.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to refresh group.' });
    }
    setIsRefreshing(false);
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

  if (propertiesLoading || scoresLoading) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span>Loading group data...</span>
      </div>
    );
  }

  // Calculate summary stats
  const latestSnapshot = groupSnapshots[0];
  
  return (
    <div className="space-y-8">
      {/* Group Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <TrendingUp className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">{group.name}</h2>
            <p className="mt-1 text-muted-foreground">
              {properties.length} {properties.length === 1 ? 'property' : 'properties'}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={properties.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="secondary"
            onClick={handleRefreshGroup}
            disabled={isRefreshing || properties.length === 0}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh All
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {latestSnapshot && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="shadow-kasa">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Weighted Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-accent">
                {latestSnapshot.weighted_score_0_10.toFixed(1)}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">out of 10</p>
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
            </CardContent>
          </Card>
          <Card className="shadow-kasa">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Last Updated
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">
                {new Date(latestSnapshot.collected_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(latestSnapshot.collected_at).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Group Trend Chart */}
      <GroupTrendChart snapshots={groupSnapshots} />

      <GroupScoresTable
        properties={properties}
        scores={scores as Record<string, Record<ReviewSource, { score: number; count: number; updated: string }>>}
        onRefreshProperty={handleRefreshProperty}
        onRemoveProperty={handleRemoveProperty}
        isRefreshing={isRefreshing}
      />

      <SnapshotHistory snapshots={groupSnapshots} type="group" />
    </div>
  );
}
