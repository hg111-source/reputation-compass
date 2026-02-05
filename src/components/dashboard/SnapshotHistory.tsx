 import { format } from 'date-fns';
 import { SourceSnapshot, GroupSnapshot, ReviewSource } from '@/lib/types';
 import { SOURCE_LABELS, formatScore, getScoreColor } from '@/lib/scoring';
 import { cn } from '@/lib/utils';
 import { History } from 'lucide-react';
 
 interface SnapshotHistoryProps {
   snapshots: SourceSnapshot[] | GroupSnapshot[];
   type: 'property' | 'group';
 }
 
 export function SnapshotHistory({ snapshots, type }: SnapshotHistoryProps) {
   if (snapshots.length === 0) {
     return (
       <div className="rounded-lg border border-dashed border-border p-6 text-center">
         <History className="mx-auto h-8 w-8 text-muted-foreground/50" />
         <p className="mt-2 text-sm text-muted-foreground">No history yet</p>
         <p className="text-xs text-muted-foreground">
           Click refresh to capture the first snapshot
         </p>
       </div>
     );
   }
 
   if (type === 'group') {
     const groupSnapshots = snapshots as GroupSnapshot[];
     return (
       <div className="space-y-2">
         <h4 className="text-sm font-medium text-muted-foreground">Snapshot History</h4>
         <div className="max-h-64 overflow-y-auto space-y-2">
           {groupSnapshots.slice(0, 10).map(snapshot => (
             <div
               key={snapshot.id}
               className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2"
             >
               <span className="text-sm text-muted-foreground">
                 {format(new Date(snapshot.collected_at), 'MMM d, yyyy h:mm a')}
               </span>
               <span className={cn('font-semibold', getScoreColor(snapshot.weighted_score_0_10))}>
                 {formatScore(snapshot.weighted_score_0_10)}
               </span>
             </div>
           ))}
         </div>
       </div>
     );
   }
 
   // Group property snapshots by collected_at timestamp
   const sourceSnapshots = snapshots as SourceSnapshot[];
   const grouped = sourceSnapshots.reduce((acc, snapshot) => {
     const key = snapshot.collected_at;
     if (!acc[key]) acc[key] = [];
     acc[key].push(snapshot);
     return acc;
   }, {} as Record<string, SourceSnapshot[]>);
 
   const sortedKeys = Object.keys(grouped).sort((a, b) => 
     new Date(b).getTime() - new Date(a).getTime()
   );
 
   return (
     <div className="space-y-2">
       <h4 className="text-sm font-medium text-muted-foreground">Snapshot History</h4>
       <div className="max-h-64 overflow-y-auto space-y-3">
         {sortedKeys.slice(0, 5).map(timestamp => (
           <div key={timestamp} className="rounded-lg bg-muted/50 p-3">
             <div className="mb-2 text-xs text-muted-foreground">
               {format(new Date(timestamp), 'MMM d, yyyy h:mm a')}
             </div>
             <div className="grid grid-cols-4 gap-2">
               {grouped[timestamp].map(snapshot => (
                 <div key={snapshot.id} className="text-center">
                   <div className="text-xs text-muted-foreground">
                     {SOURCE_LABELS[snapshot.source as ReviewSource]}
                   </div>
                   <div className={cn('text-sm font-semibold', getScoreColor(snapshot.normalized_score_0_10))}>
                     {formatScore(snapshot.normalized_score_0_10)}
                   </div>
                   <div className="text-xs text-muted-foreground">
                     {snapshot.review_count} reviews
                   </div>
                 </div>
               ))}
             </div>
           </div>
         ))}
       </div>
     </div>
   );
 }