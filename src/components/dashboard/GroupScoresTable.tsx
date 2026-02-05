 import { useMemo } from 'react';
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from '@/components/ui/table';
 import { Button } from '@/components/ui/button';
 import { ScoreCell } from './ScoreCell';
 import { Property, PropertyWithScores, ReviewSource } from '@/lib/types';
 import { REVIEW_SOURCES, SOURCE_LABELS, calculateWeightedScore, formatScore, getScoreColor } from '@/lib/scoring';
 import { RefreshCw, Trash2 } from 'lucide-react';
 import { cn } from '@/lib/utils';
 import { format } from 'date-fns';
 
 interface GroupScoresTableProps {
   properties: Property[];
   scores: Record<string, Record<ReviewSource, { score: number; count: number; updated: string }>>;
   onRefreshProperty: (propertyId: string) => void;
   onRemoveProperty?: (propertyId: string) => void;
   isRefreshing?: boolean;
 }
 
 export function GroupScoresTable({
   properties,
   scores,
   onRefreshProperty,
   onRemoveProperty,
   isRefreshing,
 }: GroupScoresTableProps) {
   const propertiesWithScores: PropertyWithScores[] = useMemo(() => {
     return properties.map(property => {
       const propertyScores = scores[property.id] || {};
       const scoreData: PropertyWithScores['scores'] = {};
       let lastUpdated: string | null = null;
 
       for (const source of REVIEW_SOURCES) {
         const sourceScore = propertyScores[source];
         if (sourceScore) {
           scoreData[source] = { score: sourceScore.score, count: sourceScore.count };
           if (!lastUpdated || sourceScore.updated > lastUpdated) {
             lastUpdated = sourceScore.updated;
           }
         }
       }
 
       const weightedScore = calculateWeightedScore(
         REVIEW_SOURCES.map(source => ({
           normalized: propertyScores[source]?.score || 0,
           count: propertyScores[source]?.count || 0,
         }))
       );
 
       return {
         ...property,
         scores: scoreData,
         weightedScore,
         lastUpdated,
       };
     });
   }, [properties, scores]);
 
   const groupWeightedScore = useMemo(() => {
     const allScores = propertiesWithScores.flatMap(p =>
       REVIEW_SOURCES.map(source => ({
         normalized: p.scores[source]?.score || 0,
         count: p.scores[source]?.count || 0,
       }))
     );
     return calculateWeightedScore(allScores);
   }, [propertiesWithScores]);
 
   if (properties.length === 0) {
     return (
       <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
         <p className="text-muted-foreground">No properties in this group yet.</p>
         <p className="mt-1 text-sm text-muted-foreground">
           Add properties from the Groups page.
         </p>
       </div>
     );
   }
 
   return (
     <div className="space-y-4">
       {/* Group summary */}
       <div className="flex items-center justify-between rounded-lg bg-card p-4 shadow-sm">
         <div>
           <div className="text-sm font-medium text-muted-foreground">Group Weighted Score</div>
           <div className={cn('text-3xl font-bold', getScoreColor(groupWeightedScore))}>
             {formatScore(groupWeightedScore)}
           </div>
         </div>
         <div className="text-right text-sm text-muted-foreground">
           {properties.length} {properties.length === 1 ? 'property' : 'properties'}
         </div>
       </div>
 
       {/* Scores table */}
       <div className="rounded-lg border border-border bg-card">
         <Table>
           <TableHeader>
             <TableRow>
               <TableHead className="w-[200px]">Property</TableHead>
               <TableHead className="w-[140px]">Location</TableHead>
               {REVIEW_SOURCES.map(source => (
                 <TableHead key={source} className="text-center w-[100px]">
                   {SOURCE_LABELS[source]}
                 </TableHead>
               ))}
               <TableHead className="text-center w-[100px]">Weighted</TableHead>
               <TableHead className="w-[120px]">Updated</TableHead>
               <TableHead className="w-[80px]"></TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
             {propertiesWithScores.map(property => (
               <TableRow key={property.id}>
                 <TableCell className="font-medium">{property.name}</TableCell>
                 <TableCell className="text-muted-foreground">
                   {property.city}, {property.state}
                 </TableCell>
                 {REVIEW_SOURCES.map(source => (
                   <TableCell key={source}>
                     <ScoreCell
                       score={property.scores[source]?.score}
                       count={property.scores[source]?.count}
                     />
                   </TableCell>
                 ))}
                 <TableCell>
                   <ScoreCell score={property.weightedScore} showCount={false} />
                 </TableCell>
                 <TableCell className="text-sm text-muted-foreground">
                   {property.lastUpdated
                     ? format(new Date(property.lastUpdated), 'MMM d, h:mm a')
                     : '—'}
                 </TableCell>
                 <TableCell>
                   <div className="flex gap-1">
                     <Button
                       variant="ghost"
                       size="icon"
                       className="h-8 w-8"
                       onClick={() => onRefreshProperty(property.id)}
                       disabled={isRefreshing}
                     >
                       <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                     </Button>
                     {onRemoveProperty && (
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-8 w-8 text-destructive hover:text-destructive"
                         onClick={() => onRemoveProperty(property.id)}
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     )}
                   </div>
                 </TableCell>
               </TableRow>
             ))}
           </TableBody>
         </Table>
       </div>
     </div>
   );
 }