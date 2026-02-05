import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, Loader2, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PropertyPlatformState, Platform, RefreshStatus } from '@/hooks/useAllPlatformsRefresh';
import { Property } from '@/lib/types';

interface AllPlatformsRefreshDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyStates: PropertyPlatformState[];
  currentPlatform: Platform | null;
  onRetry: (property: Property, platform: Platform) => void;
  isComplete: boolean;
}

const PLATFORM_LABELS: Record<Platform, { label: string; color: string }> = {
  google: { label: 'Google', color: 'text-amber-500' },
  tripadvisor: { label: 'TripAdvisor', color: 'text-orange-500' },
  booking: { label: 'Booking.com', color: 'text-blue-500' },
  expedia: { label: 'Expedia', color: 'text-purple-500' },
};

function StatusIcon({ status }: { status: RefreshStatus }) {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'in_progress':
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case 'queued':
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

export function AllPlatformsRefreshDialog({
  open,
  onOpenChange,
  propertyStates,
  currentPlatform,
  onRetry,
  isComplete,
}: AllPlatformsRefreshDialogProps) {
  const totalOperations = propertyStates.reduce((sum, p) => sum + p.platforms.length, 0);
  const completedOperations = propertyStates.reduce(
    (sum, p) => sum + p.platforms.filter(pl => pl.status === 'complete' || pl.status === 'failed').length,
    0
  );
  const failedOperations = propertyStates.reduce(
    (sum, p) => sum + p.platforms.filter(pl => pl.status === 'failed').length,
    0
  );
  const successOperations = completedOperations - failedOperations;
  const progress = totalOperations > 0 ? (completedOperations / totalOperations) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {!isComplete && currentPlatform && (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                Refreshing {PLATFORM_LABELS[currentPlatform].label}...
              </>
            )}
            {isComplete && (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Refresh Complete
              </>
            )}
            {!isComplete && !currentPlatform && (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Preparing...
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{completedOperations} of {totalOperations} operations</span>
              {isComplete && (
                <span>
                  <span className="text-emerald-500">{successOperations} success</span>
                  {failedOperations > 0 && (
                    <>, <span className="text-destructive">{failedOperations} failed</span></>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Property list */}
          <ScrollArea className="h-[300px] rounded-md border">
            <div className="p-4 space-y-4">
              {propertyStates.map(({ property, platforms }) => (
                <div key={property.id} className="space-y-2">
                  <div className="font-medium text-sm">{property.name}</div>
                  <div className="grid grid-cols-4 gap-2">
                    {platforms.map(({ platform, status, error }) => {
                      const config = PLATFORM_LABELS[platform];
                      return (
                        <div
                          key={platform}
                          className={cn(
                            'flex items-center justify-between rounded-md border px-2 py-1.5 text-xs',
                            status === 'failed' && 'border-destructive/50 bg-destructive/5'
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <StatusIcon status={status} />
                            <span className={cn('font-medium', config.color)}>
                              {config.label}
                            </span>
                          </div>
                          {status === 'failed' && isComplete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-xs"
                              onClick={() => onRetry(property, platform)}
                            >
                              Retry
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {platforms.some(p => p.error) && (
                    <div className="text-xs text-destructive">
                      {platforms.filter(p => p.error).map(p => `${PLATFORM_LABELS[p.platform].label}: ${p.error}`).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Close button */}
          {isComplete && (
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
