import { format } from 'date-fns';
import { SourceSnapshot, GroupSnapshot, ReviewSource } from '@/lib/types';
import { SOURCE_LABELS, formatScore, getScoreColor } from '@/lib/scoring';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History } from 'lucide-react';

interface SnapshotHistoryProps {
  snapshots: SourceSnapshot[] | GroupSnapshot[];
  type: 'property' | 'group';
}

export function SnapshotHistory({ snapshots, type }: SnapshotHistoryProps) {
  if (snapshots.length === 0) {
    return (
      <Card className="border-0 shadow-card">
        <CardContent className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <History className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mt-4 font-medium">No history yet</p>
          <p className="text-sm text-muted-foreground">
            Click refresh to capture the first snapshot
          </p>
        </CardContent>
      </Card>
    );
  }

  if (type === 'group') {
    const groupSnapshots = snapshots as GroupSnapshot[];
    return (
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-accent" />
            Snapshot History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {groupSnapshots.slice(0, 10).map((snapshot, index) => (
              <div
                key={snapshot.id}
                className={cn(
                  'flex items-center justify-between rounded-xl px-4 py-3 transition-colors',
                  index === 0 ? 'bg-accent/5 border border-accent/20' : 'bg-muted/50'
                )}
              >
                <div className="flex items-center gap-3">
                  {index === 0 && (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      Latest
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(snapshot.collected_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                <span className={cn('text-lg font-bold', getScoreColor(snapshot.weighted_score_0_10))}>
                  {formatScore(snapshot.weighted_score_0_10)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
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
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5 text-accent" />
          Snapshot History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-64 space-y-3 overflow-y-auto">
          {sortedKeys.slice(0, 5).map((timestamp, index) => (
            <div 
              key={timestamp} 
              className={cn(
                'rounded-xl p-4',
                index === 0 ? 'bg-accent/5 border border-accent/20' : 'bg-muted/50'
              )}
            >
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                {index === 0 && (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    Latest
                  </span>
                )}
                {format(new Date(timestamp), 'MMM d, yyyy h:mm a')}
              </div>
              <div className="grid grid-cols-4 gap-3">
                {grouped[timestamp].map(snapshot => (
                  <div key={snapshot.id} className="text-center">
                    <div className="text-xs font-medium text-muted-foreground">
                      {SOURCE_LABELS[snapshot.source as ReviewSource]}
                    </div>
                    <div className={cn('text-lg font-bold', getScoreColor(snapshot.normalized_score_0_10))}>
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
      </CardContent>
    </Card>
  );
}
