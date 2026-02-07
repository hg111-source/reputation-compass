import { Sparkles, Loader2, CheckCircle2, XCircle, Brain, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface BulkInsightState {
  propertyId: string;
  propertyName: string;
  status: 'pending' | 'fetching' | 'analyzing' | 'done' | 'error';
  error?: string;
}

interface BulkInsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isRunning: boolean;
  states: BulkInsightState[];
  progress: number;
  doneCount: number;
  errorCount: number;
  total: number;
  onCancel: () => void;
}

export function BulkInsightsDialog({
  open,
  onOpenChange,
  isRunning,
  states,
  progress,
  doneCount,
  errorCount,
  total,
  onCancel,
}: BulkInsightsDialogProps) {
  const isComplete = !isRunning && total > 0 && (doneCount + errorCount) === total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-accent" />
            Bulk AI Insights
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {isRunning ? 'Processing...' : isComplete ? 'Complete' : 'Ready'}
            </span>
            <span className="font-medium">
              {doneCount + errorCount} / {total}
              {errorCount > 0 && (
                <span className="text-destructive ml-1">({errorCount} failed)</span>
              )}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Property list */}
        <ScrollArea className="h-[350px] pr-4">
          <div className="space-y-1.5">
            {states.map((state) => (
              <div
                key={state.propertyId}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  state.status === 'fetching' && 'bg-blue-50 dark:bg-blue-950/20',
                  state.status === 'analyzing' && 'bg-accent/5',
                  state.status === 'done' && 'bg-emerald-50/50 dark:bg-emerald-950/10',
                  state.status === 'error' && 'bg-destructive/5',
                )}
              >
                {/* Status icon */}
                {state.status === 'pending' && (
                  <div className="h-4 w-4 rounded-full border-2 border-muted shrink-0" />
                )}
                {state.status === 'fetching' && (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
                )}
                {state.status === 'analyzing' && (
                  <Brain className="h-4 w-4 animate-pulse text-accent shrink-0" />
                )}
                {state.status === 'done' && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                )}
                {state.status === 'error' && (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                )}

                {/* Property name */}
                <span className={cn(
                  'flex-1 truncate',
                  state.status === 'pending' && 'text-muted-foreground',
                  state.status === 'done' && 'text-foreground',
                )}>
                  {state.propertyName}
                </span>

                {/* Status label */}
                <span className="text-xs text-muted-foreground shrink-0">
                  {state.status === 'fetching' && 'Fetching reviews...'}
                  {state.status === 'analyzing' && 'AI analyzing...'}
                  {state.status === 'done' && '✓'}
                  {state.status === 'error' && (
                    <span className="text-destructive" title={state.error}>Failed</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          {isRunning ? (
            <Button variant="outline" onClick={onCancel}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
