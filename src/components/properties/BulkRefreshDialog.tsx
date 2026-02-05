import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Loader2, Clock, XCircle } from 'lucide-react';
import { Property } from '@/lib/types';
import { cn } from '@/lib/utils';

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
  onRetry?: (propertyId: string) => void;
}

export function BulkRefreshDialog({
  open,
  onOpenChange,
  properties,
  onRetry,
}: BulkRefreshDialogProps) {
  const completedCount = properties.filter(p => p.status === 'complete').length;
  const failedCount = properties.filter(p => p.status === 'failed').length;
  const totalCount = properties.length;
  const progress = totalCount > 0 ? ((completedCount + failedCount) / totalCount) * 100 : 0;
  
  const isComplete = completedCount + failedCount === totalCount;
  const inProgressProperty = properties.find(p => p.status === 'in_progress');
  const queuedCount = properties.filter(p => p.status === 'queued').length;
  
  // Estimate ~2.5 seconds per property (2s delay + API call time)
  const estimatedSeconds = queuedCount * 2.5 + (inProgressProperty ? 1 : 0);

  const getStatusIcon = (status: RefreshStatus) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 animate-spin text-accent" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'queued':
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: RefreshStatus) => {
    switch (status) {
      case 'complete':
        return 'Complete';
      case 'in_progress':
        return 'In progress...';
      case 'failed':
        return 'Failed';
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
          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{Math.round(progress)}% complete</span>
              {!isComplete && estimatedSeconds > 0 && (
                <span>~{Math.ceil(estimatedSeconds)}s remaining</span>
              )}
            </div>
          </div>

          {/* Property list */}
          <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border bg-muted/30 p-3">
            {properties.map(({ property, status, error }) => (
              <div
                key={property.id}
                className={cn(
                  'flex items-center justify-between rounded-md px-3 py-2 text-sm',
                  status === 'in_progress' && 'bg-accent/10',
                  status === 'failed' && 'bg-red-50 dark:bg-red-950/20'
                )}
              >
                <div className="flex items-center gap-2">
                  {getStatusIcon(status)}
                  <span className={cn(
                    status === 'complete' && 'text-green-700 dark:text-green-400',
                    status === 'failed' && 'text-red-600 dark:text-red-400',
                    status === 'queued' && 'text-muted-foreground'
                  )}>
                    {property.name}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {getStatusText(status)}
                </span>
              </div>
            ))}
          </div>

          {/* Summary when complete */}
          {isComplete && (
            <div className="space-y-2 rounded-lg border bg-card p-4">
              {completedCount > 0 && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {completedCount} hotel{completedCount !== 1 ? 's' : ''} updated successfully
                  </span>
                </div>
              )}
              {failedCount > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-amber-600">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {failedCount} hotel{failedCount !== 1 ? 's' : ''} failed
                    </span>
                  </div>
                  <p className="pl-6 text-xs text-muted-foreground">
                    Click on failed hotels to retry individually
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            {isComplete ? (
              <Button onClick={() => onOpenChange(false)}>
                Done
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
