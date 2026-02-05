import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, Loader2, Clock, RefreshCw, AlertCircle, RotateCcw, Globe, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PropertyRefreshState, Platform, RefreshStatus, RefreshPhase } from '@/hooks/useUnifiedRefresh';
import { Property } from '@/lib/types';

interface UnifiedRefreshDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyStates: PropertyRefreshState[];
  currentPhase: RefreshPhase;
  currentPlatform: Platform | null;
  onRetry: (property: Property, platform: Platform) => void;
  onRetryAllFailed: () => void;
  failedCount: number;
  isComplete: boolean;
  isRunning: boolean;
}

const PLATFORM_LABELS: Record<Platform, { label: string; color: string }> = {
  google: { label: 'Google', color: 'text-amber-500' },
  tripadvisor: { label: 'TripAdvisor', color: 'text-orange-500' },
  booking: { label: 'Booking.com', color: 'text-blue-500' },
  expedia: { label: 'Expedia', color: 'text-purple-500' },
};

const PHASE_CONFIG: Record<RefreshPhase, { label: string; icon: React.ReactNode }> = {
  idle: { label: 'Ready', icon: <Clock className="h-4 w-4" /> },
  normalizing: { label: 'Normalizing names...', icon: <Sparkles className="h-4 w-4 animate-pulse" /> },
  resolving: { label: 'Resolving URLs...', icon: <Globe className="h-4 w-4 animate-pulse" /> },
  fetching: { label: 'Fetching ratings...', icon: <RefreshCw className="h-4 w-4 animate-spin" /> },
  complete: { label: 'Complete', icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
};

function StatusIcon({ status }: { status: RefreshStatus }) {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'not_listed':
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'resolving':
      return <Globe className="h-4 w-4 animate-pulse text-blue-500" />;
    case 'fetching':
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case 'queued':
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

export function UnifiedRefreshDialog({
  open,
  onOpenChange,
  propertyStates,
  currentPhase,
  currentPlatform,
  onRetry,
  onRetryAllFailed,
  failedCount,
  isComplete,
  isRunning,
}: UnifiedRefreshDialogProps) {
  const totalOperations = propertyStates.reduce((sum, p) => sum + p.platforms.length, 0);
  const completedOperations = propertyStates.reduce(
    (sum, p) => sum + p.platforms.filter(pl => ['complete', 'failed', 'not_listed'].includes(pl.status)).length,
    0
  );
  const failedOperations = propertyStates.reduce(
    (sum, p) => sum + p.platforms.filter(pl => pl.status === 'failed').length,
    0
  );
  const notListedOperations = propertyStates.reduce(
    (sum, p) => sum + p.platforms.filter(pl => pl.status === 'not_listed').length,
    0
  );
  const successOperations = completedOperations - failedOperations - notListedOperations;
  const progress = totalOperations > 0 ? (completedOperations / totalOperations) * 100 : 0;

  const phaseConfig = PHASE_CONFIG[currentPhase];
  const currentPlatformConfig = currentPlatform ? PLATFORM_LABELS[currentPlatform] : null;

  // Calculate phase progress indicator
  const getPhaseProgress = () => {
    switch (currentPhase) {
      case 'normalizing': return 10;
      case 'resolving': return 30;
      case 'fetching': return 30 + (progress * 0.7);
      case 'complete': return 100;
      default: return 0;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isRunning ? (
              <>
                {phaseConfig.icon}
                <span>
                  {currentPhase === 'fetching' && currentPlatform 
                    ? `Fetching ${currentPlatformConfig?.label}...`
                    : phaseConfig.label
                  }
                </span>
              </>
            ) : isComplete ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Refresh Complete
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Preparing...
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Phase indicators */}
          <div className="flex items-center justify-between text-xs">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full",
              currentPhase === 'resolving' ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "text-muted-foreground"
            )}>
              <Globe className="h-3 w-3" />
              Resolve URLs
            </div>
            <div className="h-px flex-1 bg-border mx-2" />
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full",
              currentPhase === 'fetching' ? "bg-primary/10 text-primary" : "text-muted-foreground"
            )}>
              <RefreshCw className="h-3 w-3" />
              Fetch Ratings
            </div>
            <div className="h-px flex-1 bg-border mx-2" />
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full",
              currentPhase === 'complete' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "text-muted-foreground"
            )}>
              <CheckCircle2 className="h-3 w-3" />
              Done
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={getPhaseProgress()} className="h-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{completedOperations} of {totalOperations} operations</span>
              {isComplete && (
                <span>
                  <span className="text-emerald-500">{successOperations} success</span>
                  {notListedOperations > 0 && (
                    <>, <span className="text-muted-foreground">{notListedOperations} not listed</span></>
                  )}
                  {failedOperations > 0 && (
                    <>, <span className="text-destructive">{failedOperations} failed</span></>
                  )}
                </span>
              )}
            </div>
            {isRunning && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                You can close this dialog — refresh will continue in the background.
              </p>
            )}
          </div>

          {/* Property list */}
          <ScrollArea className="h-[300px] rounded-md border">
            <div className="p-4 space-y-4">
              {propertyStates.map(({ property, phase, platforms }) => (
                <div key={property.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{property.name}</span>
                    {phase === 'resolving' && (
                      <span className="text-xs text-blue-500 flex items-center gap-1">
                        <Globe className="h-3 w-3 animate-pulse" />
                        Resolving
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {platforms.map(({ platform, status, error }) => {
                      const config = PLATFORM_LABELS[platform];
                      return (
                        <div
                          key={platform}
                          className={cn(
                            'flex items-center justify-between rounded-md border px-2 py-1.5 text-xs',
                            status === 'failed' && 'border-destructive/50 bg-destructive/5',
                            status === 'fetching' && 'border-primary/50 bg-primary/5',
                            status === 'resolving' && 'border-blue-500/50 bg-blue-500/5',
                            status === 'not_listed' && 'border-muted bg-muted/20'
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <StatusIcon status={status} />
                            <span className={cn('font-medium', config.color)}>
                              {config.label}
                            </span>
                          </div>
                          {status === 'failed' && isComplete && !isRunning && (
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

          {/* Action buttons */}
          {isComplete && !isRunning && (
            <div className="flex justify-between">
              {failedCount > 0 && (
                <Button 
                  variant="outline" 
                  onClick={onRetryAllFailed}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retry All Failed ({failedCount})
                </Button>
              )}
              <div className="flex-1" />
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

// Keep the old export for backward compatibility
export { UnifiedRefreshDialog as AllPlatformsRefreshDialog };
