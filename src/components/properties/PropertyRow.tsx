import { MapPin, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Property, ReviewSource } from '@/lib/types';
import { 
  getScoreColor, 
  formatScore, 
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
  // Calculate weighted average and total reviews using centralized logic
  const { avgScore: weightedAvg, totalReviews } = calculatePropertyMetrics(scores);

  const renderPlatformCell = (platform: ReviewSource) => {
    const data = scores?.[platform];
    const isRefreshingThis = isRefreshing && refreshingSource === platform;

    return (
      <TableCell key={platform} className="text-center">
        <div className="flex flex-col items-center gap-0.5">
          {data && data.score > 0 ? (
            <>
              <span className={cn('font-semibold', getScoreColor(data.score))}>
                {formatScore(data.score)}
              </span>
              <span className="text-xs text-muted-foreground">
                {data.count.toLocaleString()}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </TableCell>
    );
  };

  return (
    <TableRow className="group">
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
          <span className={cn('text-xl font-bold', getScoreColor(weightedAvg))}>
            {weightedAvg.toFixed(1)}
          </span>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
      </TableCell>

      {/* Total Reviews - PRIMARY */}
      <TableCell className="text-center">
        {totalReviews > 0 ? (
          <span className="font-semibold text-foreground">
            {totalReviews.toLocaleString()}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Platform scores inline */}
      {REVIEW_SOURCES.map(renderPlatformCell)}

      {/* Actions */}
      <TableCell>
        <div className="flex items-center justify-end gap-0.5">
          {/* Refresh buttons */}
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6', PLATFORM_COLORS.google)}
            onClick={() => onRefreshGoogle(property)}
            disabled={isRefreshing}
            title="Refresh Google"
          >
            <RefreshCw className={cn('h-3 w-3', isRefreshing && refreshingSource === 'google' && 'animate-spin')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6', PLATFORM_COLORS.tripadvisor)}
            onClick={() => onRefreshOTA(property, 'tripadvisor')}
            disabled={isRefreshing}
            title="Refresh TripAdvisor"
          >
            <RefreshCw className={cn('h-3 w-3', isRefreshing && refreshingSource === 'tripadvisor' && 'animate-spin')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6', PLATFORM_COLORS.booking)}
            onClick={() => onRefreshOTA(property, 'booking')}
            disabled={isRefreshing}
            title="Refresh Booking"
          >
            <RefreshCw className={cn('h-3 w-3', isRefreshing && refreshingSource === 'booking' && 'animate-spin')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6', PLATFORM_COLORS.expedia)}
            onClick={() => onRefreshOTA(property, 'expedia')}
            disabled={isRefreshing}
            title="Refresh Expedia"
          >
            <RefreshCw className={cn('h-3 w-3', isRefreshing && refreshingSource === 'expedia' && 'animate-spin')} />
          </Button>
          
          {/* Delete button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            onClick={() => onDelete(property.id, property.name)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
