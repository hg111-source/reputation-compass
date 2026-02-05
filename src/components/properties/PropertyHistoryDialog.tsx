import { format } from 'date-fns';
import { History, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Property, SourceSnapshot, ReviewSource } from '@/lib/types';
import { usePropertySnapshots } from '@/hooks/useSnapshots';
import { cn } from '@/lib/utils';
import { getScoreColor, formatScore, calculateWeightedScore, REVIEW_SOURCES, SOURCE_LABELS } from '@/lib/scoring';

const TREND_THRESHOLD = 0.05;

function getTrendIndicator(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  if (diff > TREND_THRESHOLD) return { icon: TrendingUp, color: 'text-emerald-500', label: 'Up' };
  if (diff < -TREND_THRESHOLD) return { icon: TrendingDown, color: 'text-red-500', label: 'Down' };
  return { icon: Minus, color: 'text-muted-foreground', label: 'Flat' };
}

interface PropertyHistoryDialogProps {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SnapshotRow {
  date: string;
  scores: Record<ReviewSource, { score: number; count: number } | null>;
  weightedAvg: number | null;
}

export function PropertyHistoryDialog({ property, open, onOpenChange }: PropertyHistoryDialogProps) {
  const { data: snapshots = [], isLoading } = usePropertySnapshots(property?.id ?? null);

  // Group snapshots by collected_at timestamp and calculate weighted averages
  const groupedRows: SnapshotRow[] = (() => {
    if (snapshots.length === 0) return [];

    const grouped = snapshots.reduce((acc, snapshot) => {
      const key = snapshot.collected_at;
      if (!acc[key]) acc[key] = [];
      acc[key].push(snapshot);
      return acc;
    }, {} as Record<string, SourceSnapshot[]>);

    const sortedKeys = Object.keys(grouped).sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );

    return sortedKeys.map(timestamp => {
      const snapshotsAtTime = grouped[timestamp];
      const scores: Record<ReviewSource, { score: number; count: number } | null> = {
        google: null,
        tripadvisor: null,
        booking: null,
        expedia: null,
      };

      const allScores: { normalized: number; count: number }[] = [];

      for (const snapshot of snapshotsAtTime) {
        scores[snapshot.source as ReviewSource] = {
          score: snapshot.normalized_score_0_10,
          count: snapshot.review_count,
        };
        allScores.push({
          normalized: snapshot.normalized_score_0_10,
          count: snapshot.review_count,
        });
      }

      const weightedAvg = calculateWeightedScore(allScores);

      return {
        date: timestamp,
        scores,
        weightedAvg,
      };
    });
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-accent" />
            Score History: {property?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : groupedRows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No history yet</p>
              <p className="text-sm">Refresh scores to start tracking history</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {REVIEW_SOURCES.map(source => (
                    <TableHead key={source} className="text-center">
                      {SOURCE_LABELS[source]}
                    </TableHead>
                  ))}
                  <TableHead className="text-center">Weighted Avg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedRows.map((row, index) => (
                  <TableRow key={row.date} className={index === 0 ? 'bg-accent/5' : ''}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {index === 0 && (
                          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                            Latest
                          </span>
                        )}
                        {format(new Date(row.date), 'MMM d, yyyy h:mm a')}
                      </div>
                    </TableCell>
                    {REVIEW_SOURCES.map(source => {
                      const data = row.scores[source];
                      const prevRow = groupedRows[index + 1];
                      const prevData = prevRow?.scores[source];
                      const trend = getTrendIndicator(data?.score ?? null, prevData?.score ?? null);
                      return (
                        <TableCell key={source} className="text-center">
                          {data ? (
                            <div className="flex items-center justify-center gap-1">
                              <div>
                                <span className={cn('font-semibold', getScoreColor(data.score))}>
                                  {formatScore(data.score)}
                                </span>
                                <div className="text-xs text-muted-foreground">
                                  {data.count.toLocaleString()}
                                </div>
                              </div>
                              {trend && (
                                <trend.icon className={cn('h-3 w-3', trend.color)} aria-label={trend.label} />
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      {(() => {
                        const prevRow = groupedRows[index + 1];
                        const trend = getTrendIndicator(row.weightedAvg, prevRow?.weightedAvg ?? null);
                        return (
                          <div className="flex items-center justify-center gap-1">
                            <span className={cn('font-bold', row.weightedAvg !== null ? getScoreColor(row.weightedAvg) : 'text-muted-foreground')}>
                              {row.weightedAvg !== null ? row.weightedAvg.toFixed(1) : '—'}
                            </span>
                            {trend && (
                              <trend.icon className={cn('h-3 w-3', trend.color)} aria-label={trend.label} />
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
