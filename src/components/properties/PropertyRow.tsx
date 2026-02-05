import { MapPin, Trash2, RefreshCw, ExternalLink } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

  // Generate hotel link - use website_url if available, otherwise Google search
  const getHotelLink = () => {
    if (property.website_url) {
      return property.website_url;
    }
    // Fallback to Google search
    const query = encodeURIComponent(`${property.name} hotel ${property.city} ${property.state}`);
    return `https://www.google.com/search?q=${query}`;
  };

  const handleRefresh = (platform: ReviewSource) => {
    if (platform === 'google') {
      onRefreshGoogle(property);
    } else {
      onRefreshOTA(property, platform as 'tripadvisor' | 'booking' | 'expedia');
    }
  };

  const renderPlatformCell = (platform: ReviewSource) => {
    const data = scores?.[platform];
    const isRefreshingThis = isRefreshing && refreshingSource === platform;

    return (
      <TableCell key={platform} className="text-center group/cell">
        <div className="relative flex flex-col items-center gap-0.5">
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
          {/* Hover refresh button */}
          <button
            onClick={() => handleRefresh(platform)}
            disabled={isRefreshing}
            className={cn(
              'absolute -right-1 -top-1 rounded-full p-0.5 opacity-0 transition-opacity',
              'bg-background shadow-sm border border-border',
              'hover:bg-muted group-hover/cell:opacity-100',
              isRefreshingThis && 'opacity-100'
            )}
            title={`Refresh ${platform}`}
          >
            <RefreshCw className={cn('h-3 w-3 text-muted-foreground', isRefreshingThis && 'animate-spin')} />
          </button>
        </div>
      </TableCell>
    );
  };

  return (
    <TableRow className="group">
      {/* Hotel Name */}
      <TableCell className="font-medium">
        <a
          href={getHotelLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-primary hover:underline transition-colors"
        >
          {property.name}
          {property.website_url && (
            <ExternalLink className="h-3 w-3 text-muted-foreground/50" />
          )}
        </a>
      </TableCell>

      {/* Location */}
      <TableCell>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {property.city}, {property.state}
        </div>
      </TableCell>

      {/* Average Score - PRIMARY with tooltip */}
      <TableCell className="text-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn('cursor-help text-base font-semibold', weightedAvg !== null ? getScoreColor(weightedAvg) : 'text-muted-foreground')}>
                {weightedAvg !== null ? weightedAvg.toFixed(1) : '—'}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-semibold">Weighted Average Score</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Calculated as: Σ(score × reviews) ÷ Σ(reviews)
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Platforms with more reviews have greater influence on this score.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>

      {/* Total Reviews - PRIMARY */}
      <TableCell className="text-center">
        {totalReviews > 0 ? (
          <span className="text-base font-semibold text-foreground">
            {totalReviews.toLocaleString()}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Platform scores inline */}
      {REVIEW_SOURCES.map(renderPlatformCell)}

      {/* Actions - just delete */}
      <TableCell>
        <div className="flex items-center justify-end">
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
  );
}
