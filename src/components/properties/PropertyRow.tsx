import { useState } from 'react';
import { ChevronDown, ChevronRight, MapPin, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Property, ReviewSource } from '@/lib/types';
import { 
  getScoreColor, 
  formatScore, 
  SOURCE_LABELS, 
  REVIEW_SOURCES,
  calculatePropertyMetrics 
} from '@/lib/scoring';

interface PlatformScore {
  score: number;
  count: number;
  updated: string;
}

interface PropertyRowProps {
  property: Property;
  scores: Record<ReviewSource, PlatformScore> | undefined;
  onDelete: (id: string, name: string) => void;
  onRefreshGoogle: (property: Property) => void;
  onRefreshOTA: (property: Property, source: 'tripadvisor' | 'booking' | 'expedia') => void;
  isRefreshing: boolean;
  refreshingSource: string | null;
}

const PLATFORM_COLORS: Record<ReviewSource, string> = {
  google: 'text-amber-600',
  tripadvisor: 'text-orange-600',
  booking: 'text-blue-600',
  expedia: 'text-purple-600',
};

export function PropertyRow({
  property,
  scores,
  onDelete,
  onRefreshGoogle,
  onRefreshOTA,
  isRefreshing,
  refreshingSource,
}: PropertyRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate weighted average and total reviews using centralized logic
  // See src/lib/scoring.ts for formula documentation and assumptions
  const { avgScore: weightedAvg, totalReviews } = calculatePropertyMetrics(scores);

  return (
    <>
      <TableRow className="group">
        {/* Expand/collapse toggle */}
        <TableCell className="w-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>

        {/* Hotel Name */}
        <TableCell className="font-medium">{property.name}</TableCell>

        {/* Location */}
        <TableCell>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {property.city}, {property.state}
          </div>
        </TableCell>

        {/* Avg Score - PRIMARY */}
        <TableCell className="text-center">
          {weightedAvg !== null ? (
            <span className={cn('text-2xl font-bold', getScoreColor(weightedAvg))}>
              {weightedAvg.toFixed(1)}
            </span>
          ) : (
            <span className="text-muted-foreground">N/A</span>
          )}
        </TableCell>

        {/* Total Reviews - PRIMARY */}
        <TableCell className="text-center">
          {totalReviews > 0 ? (
            <span className="text-lg font-semibold text-foreground">
              {totalReviews.toLocaleString()}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Actions */}
        <TableCell>
          <div className="flex items-center justify-end gap-1">
            {/* Delete button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              onClick={() => onDelete(property.id, property.name)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded platform details */}
      {isExpanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={6} className="py-4">
            <div className="grid grid-cols-4 gap-4 pl-10">
              {REVIEW_SOURCES.map((platform) => {
                const data = scores?.[platform];
                const isRefreshingThis = isRefreshing && refreshingSource === platform;

                return (
                  <div
                    key={platform}
                    className="flex items-center justify-between rounded-lg border bg-card p-3"
                  >
                    <div>
                      <div className={cn('text-sm font-medium', PLATFORM_COLORS[platform])}>
                        {SOURCE_LABELS[platform]}
                      </div>
                      {data && data.score > 0 ? (
                        <div className="mt-1">
                          <span className={cn('text-lg font-bold', getScoreColor(data.score))}>
                            {formatScore(data.score)}
                          </span>
                          <span className="ml-2 text-sm text-muted-foreground">
                            ({data.count.toLocaleString()} reviews)
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1 text-sm text-muted-foreground">No data</div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn('h-7 w-7', PLATFORM_COLORS[platform])}
                      onClick={() =>
                        platform === 'google'
                          ? onRefreshGoogle(property)
                          : onRefreshOTA(property, platform)
                      }
                      disabled={isRefreshing}
                    >
                      <RefreshCw
                        className={cn('h-3.5 w-3.5', isRefreshingThis && 'animate-spin')}
                      />
                    </Button>
                  </div>
                );
              })}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
