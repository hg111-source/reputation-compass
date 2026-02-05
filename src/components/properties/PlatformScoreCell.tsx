import { ReviewSource } from '@/lib/types';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScoreColor } from '@/lib/scoring';
import { format } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PlatformScoreData {
  score: number;
  count: number;
  updated: string;
}

interface PlatformScoreCellProps {
  data?: PlatformScoreData;
  platform: ReviewSource;
}

const PLATFORM_ICONS: Record<ReviewSource, { icon: string; color: string }> = {
  google: { icon: 'G', color: 'text-amber-500' },
  tripadvisor: { icon: 'TA', color: 'text-orange-500' },
  booking: { icon: 'B', color: 'text-blue-500' },
  expedia: { icon: 'E', color: 'text-purple-500' },
};

export function PlatformScoreCell({ data, platform }: PlatformScoreCellProps) {
  if (!data) {
    return <span className="text-muted-foreground">—</span>;
  }

  const scoreColor = getScoreColor(data.score);
  const config = PLATFORM_ICONS[platform];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center gap-1 cursor-help">
            <span className={cn('text-xs font-medium', config.color)}>{config.icon}</span>
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
