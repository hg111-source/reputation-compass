import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Loader2, Clock, AlertTriangle, X, RotateCcw } from 'lucide-react';
import { Property } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export type RefreshStatus = 'queued' | 'in_progress' | 'complete' | 'failed';

export interface PropertyRefreshState {
  property: Property;
  status: RefreshStatus;
  error?: string;
}

interface BulkRefreshDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: PropertyRefreshState[];
  onRetry: (property: Property) => void;
  isComplete: boolean;
}

export function BulkRefreshDialog({
  open,
  onOpenChange,
  properties,
  onRetry,
  isComplete,
}: BulkRefreshDialogProps) {
  const completedCount = properties.filter(p => p.status === 'complete').length;
  const failedCount = properties.filter(p => p.status === 'failed').length;
  const inProgressCount = properties.filter(p => p.status === 'in_progress').length;
  const totalCount = properties.length;
  const processedCount = completedCount + failedCount;
  const startedCount = processedCount + inProgressCount;
  const progress = totalCount > 0 ? (startedCount / totalCount) * 100 : 0;
  
  const failedProperties = properties.filter(p => p.status === 'failed');

  const getStatusIcon = (status: RefreshStatus) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />;
      case 'queued':
      default:
        return <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />;
    }
  };

  const getStatusText = (state: PropertyRefreshState) => {
    switch (state.status) {
      case 'complete':
        return 'Complete';
      case 'in_progress':
        return 'In progress...';
      case 'failed':
        return state.error || 'Failed';
      case 'queued':
      default:
        return 'Queued';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isComplete ? 'Refresh Complete' : 'Fetching Google Reviews'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!isComplete ? (
            <>
              {/* Progress bar */}
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  {processedCount} of {totalCount} complete
                </p>
              </div>

              {/* Property list */}
              <ScrollArea className="h-64 rounded-lg border bg-muted/30">
                <div className="space-y-1 p-3">
                  {properties.map(({ property, status, error }) => (
                    <div
                      key={property.id}
                      className={cn(
                        'flex items-center justify-between rounded-md px-3 py-2 text-sm',
                        status === 'in_progress' && 'bg-accent/10',
                        status === 'failed' && 'bg-amber-50 dark:bg-amber-950/20'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getStatusIcon(status)}
                        <span className={cn(
                          'truncate',
                          status === 'complete' && 'text-green-700 dark:text-green-400',
                          status === 'failed' && 'text-amber-600 dark:text-amber-400',
                          status === 'queued' && 'text-muted-foreground'
                        )}>
                          {property.name}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {getStatusText({ property, status, error })}
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
                {completedCount > 0 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">
                      {completedCount} hotel{completedCount !== 1 ? 's' : ''} updated successfully
                    </span>
                  </div>
                )}
                {failedCount > 0 && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">
                      {failedCount} hotel{failedCount !== 1 ? 's' : ''} failed
                    </span>
                  </div>
                )}
              </div>

              {/* Failed properties with retry */}
              {failedProperties.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Failed properties:
                  </p>
                  <ScrollArea className="max-h-48 rounded-lg border">
                    <div className="space-y-1 p-2">
                      {failedProperties.map(({ property, error }) => (
                        <div
                          key={property.id}
                          className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{property.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {error || 'Unknown error'}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-2 h-8 gap-1.5 shrink-0"
                            onClick={() => onRetry(property)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Retry
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            {isComplete ? (
              <Button onClick={() => onOpenChange(false)}>
                Close
              </Button>
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
