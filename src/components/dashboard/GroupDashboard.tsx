 import { useState } from 'react';
 import { Group, ReviewSource } from '@/lib/types';
 import { useGroupProperties } from '@/hooks/useGroups';
 import { useLatestPropertyScores, useGroupSnapshots, useRefreshScores } from '@/hooks/useSnapshots';
 import { GroupScoresTable } from './GroupScoresTable';
 import { SnapshotHistory } from './SnapshotHistory';
 import { Button } from '@/components/ui/button';
 import { RefreshCw, Download } from 'lucide-react';
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
     return <div className="animate-pulse text-muted-foreground">Loading group data...</div>;
   }
 
   return (
     <div className="space-y-6">
       <div className="flex items-center justify-between">
         <h2 className="text-xl font-semibold">{group.name}</h2>
         <div className="flex gap-2">
           <Button
             variant="outline"
             size="sm"
             onClick={handleExport}
             disabled={properties.length === 0}
           >
             <Download className="mr-2 h-4 w-4" />
             Export CSV
           </Button>
           <Button
             size="sm"
             onClick={handleRefreshGroup}
             disabled={isRefreshing || properties.length === 0}
           >
             <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
             Refresh All
           </Button>
         </div>
       </div>
 
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