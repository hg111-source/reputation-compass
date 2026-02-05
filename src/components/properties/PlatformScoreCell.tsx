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
  // No data at all - show dash
  if (!data) {
    return <span className="text-muted-foreground">—</span>;
  }

  // Not listed status
  if (data.status === 'not_listed' || data.score === null) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center gap-1 cursor-help">
              {showIcon && <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="text-muted-foreground text-sm">N/A</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <div className="space-y-1">
              <div className="font-medium">Not listed on {PLATFORM_DISPLAY[platform]}</div>
              <div className="text-muted-foreground">
                Last checked: {format(new Date(data.updated), 'MMM d, h:mm a')}
              </div>
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
