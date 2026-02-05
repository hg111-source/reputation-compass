import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, Loader2, XCircle, Globe } from 'lucide-react';
import { BulkResolveProgress, PropertyResolveState } from '@/hooks/useResolveUrls';
import { cn } from '@/lib/utils';

interface ResolveUrlsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: BulkResolveProgress | null;
  isComplete: boolean;
}

export function ResolveUrlsDialog({
  open,
  onOpenChange,
  progress,
  isComplete,
}: ResolveUrlsDialogProps) {
  if (!progress) return null;

  const { current, total, currentProperty, results } = progress;
  const progressPercent = total > 0 ? (current / total) * 100 : 0;

  // Calculate summary stats
  const summary = {
    booking: results.filter(r => r.foundPlatforms.includes('booking')).length,
    tripadvisor: results.filter(r => r.foundPlatforms.includes('tripadvisor')).length,
    expedia: results.filter(r => r.foundPlatforms.includes('expedia')).length,
    errors: results.filter(r => r.status === 'error').length,
  };

  const getStatusIcon = (state: PropertyResolveState) => {
    if (state.status === 'error') {
      return <XCircle className="h-4 w-4 shrink-0 text-destructive" />;
    }
    if (state.status === 'complete') {
      const foundCount = state.foundPlatforms.length;
      if (foundCount === 3) {
        return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />;
      }
      if (foundCount > 0) {
        return <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-500" />;
      }
      return <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />;
    }
    return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {isComplete ? 'URL Resolution Complete' : 'Resolving Platform URLs'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!isComplete ? (
            <>
              {/* Progress bar */}
              <div className="space-y-2">
                <Progress value={progressPercent} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {current} of {total} properties processed
                </p>
                {currentProperty && (
                  <p className="text-sm font-medium">
                    Currently: {currentProperty}
                  </p>
                )}
              </div>

              {/* Property list */}
              <ScrollArea className="h-64 rounded-lg border bg-muted/30">
                <div className="space-y-1 p-3">
                  {results.map((state) => (
                    <div
                      key={state.property.id}
                      className={cn(
                        'flex items-center justify-between rounded-md px-3 py-2 text-sm',
                        state.status === 'error' && 'bg-destructive/10'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getStatusIcon(state)}
                        <span className="truncate">{state.property.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {state.foundPlatforms.length}/3 found
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            <>
              {/* Summary */}
              <div className="space-y-3 rounded-lg border bg-card p-4">
                <h4 className="font-medium">Results Summary</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{summary.booking}</p>
                    <p className="text-xs text-muted-foreground">Booking.com</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{summary.tripadvisor}</p>
                    <p className="text-xs text-muted-foreground">TripAdvisor</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{summary.expedia}</p>
                    <p className="text-xs text-muted-foreground">Expedia</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  out of {total} properties
                </p>
                {summary.errors > 0 && (
                  <p className="text-sm text-destructive text-center">
                    {summary.errors} error{summary.errors > 1 ? 's' : ''} occurred
                  </p>
                )}
              </div>

              {/* Detailed results */}
              <ScrollArea className="max-h-48 rounded-lg border">
                <div className="space-y-1 p-2">
                  {results.map((state) => (
                    <div
                      key={state.property.id}
                      className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getStatusIcon(state)}
                        <span className="truncate text-sm">{state.property.name}</span>
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        {['booking', 'tripadvisor', 'expedia'].map((p) => (
                          <span
                            key={p}
                            className={cn(
                              'w-2 h-2 rounded-full',
                              state.foundPlatforms.includes(p)
                                ? 'bg-green-500'
                                : 'bg-muted-foreground/30'
                            )}
                            title={`${p}: ${state.foundPlatforms.includes(p) ? 'Found' : 'Not found'}`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            {isComplete ? (
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            ) : (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Run in Background
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
