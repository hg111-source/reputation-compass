import { ReviewSource } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getScoreColor } from '@/lib/scoring';
import { format } from 'date-fns';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PlatformScoreData {
  score: number | null;
  count: number;
  updated: string;
  status?: 'found' | 'not_listed';
}

interface PlatformScoreCellProps {
  data?: PlatformScoreData;
  platform: ReviewSource;
  showIcon?: boolean;
}

const PLATFORM_DISPLAY: Record<ReviewSource, string> = {
  google: 'Google',
  tripadvisor: 'TripAdvisor',
  booking: 'Booking.com',
  expedia: 'Expedia',
};

export function PlatformScoreCell({ data, platform, showIcon = false }: PlatformScoreCellProps) {
  // No data or not listed - show orange "?"
  if (!data || data.status === 'not_listed' || data.score === null) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center gap-1 cursor-help">
              {showIcon && <XCircle className="h-3.5 w-3.5 text-orange-500" />}
              <span className="text-orange-500 font-semibold">?</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <div className="space-y-1">
              <div className="font-medium">
                {data?.status === 'not_listed' ? `Not listed on ${PLATFORM_DISPLAY[platform]}` : 'Rating not found'}
              </div>
              <div className="text-muted-foreground">Not included in weighted average</div>
              {data?.updated && (
                <div className="text-muted-foreground">
                  Last checked: {format(new Date(data.updated), 'MMM d, h:mm a')}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const scoreColor = getScoreColor(data.score);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center gap-1 cursor-help">
            {showIcon && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
            <span className={cn('font-semibold', scoreColor)}>
              {data.score.toFixed(1)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="space-y-1">
            <div className="font-medium">{data.count.toLocaleString()} reviews</div>
            <div className="text-muted-foreground">
              Updated: {format(new Date(data.updated), 'MMM d, h:mm a')}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
