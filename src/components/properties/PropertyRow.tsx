import { MapPin, Trash2, RefreshCw, ExternalLink, History, Sparkles, AlertCircle, Loader2, Minus } from 'lucide-react';
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
import { Platform } from '@/hooks/useUnifiedRefresh';
import { HealingItem } from '@/hooks/useAutoHeal';

interface PlatformScore {
  score: number;
  count: number;
  updated: string;
  status?: string;
}

interface PropertyRowProps {
  property: Property;
  scores: Record<ReviewSource, PlatformScore> | undefined;
  onDelete: (id: string, name: string) => void;
  onRefreshPlatform: (property: Property, platform: Platform) => void;
  onRefreshAllPlatforms: (property: Property) => void;
  onViewHistory: (property: Property) => void;
  onAnalyzeReviews: (property: Property) => void;
  isRefreshing: boolean;
  refreshingPropertyId: string | null;
  currentPlatform: Platform | null;
  getHealingStatus?: (propertyId: string, platform: Platform) => HealingItem | undefined;
  hasReviewData?: boolean;
}

export function PropertyRow({
  property,
  scores,
  onDelete,
  onRefreshPlatform,
  onRefreshAllPlatforms,
  onViewHistory,
  onAnalyzeReviews,
  isRefreshing,
  refreshingPropertyId,
  currentPlatform,
  getHealingStatus,
  hasReviewData,
}: PropertyRowProps) {
  // Only show refresh state if THIS property is the one being refreshed
  const isThisRefreshing = isRefreshing && refreshingPropertyId === property.id;
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

  const renderPlatformCell = (platform: ReviewSource) => {
    const data = scores?.[platform];
    const isRefreshingThis = isThisRefreshing && currentPlatform === platform;
    const healingItem = getHealingStatus?.(property.id, platform as Platform);
    const isAutoHealing = healingItem?.status === 'retrying' || healingItem?.status === 'queued';
    const healFailed = healingItem?.status === 'failed';

    return (
      <TableCell key={platform} className="text-center group/cell">
        <div className="relative flex flex-col items-center gap-0.5">
          {data && data.score != null && data.score > 0 ? (
            <>
              <span className={cn('font-semibold', getScoreColor(data.score))}>
                {formatScore(data.score)}
              </span>
              <span className="text-xs text-muted-foreground">
                {data.count.toLocaleString()}
              </span>
            </>
          ) : isRefreshingThis || isAutoHealing ? (
            /* While retrying → show spinner */
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-help">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Fetching...</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {healingItem ? `Attempt ${healingItem.retryCount}/${3}` : 'Refreshing...'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : healFailed ? (
            /* After all retries fail → show "—" with tooltip */
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-help">
                    <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground font-semibold">—</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-xs">
                  <p className="font-medium">Unavailable after {healingItem?.retryCount} attempts</p>
                  {healingItem?.error && (
                    <p className="text-muted-foreground mt-1">{healingItem.error}</p>
                  )}
                  <p className="text-muted-foreground mt-1">Click refresh to try again manually</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : data?.status === 'not_listed' ? (
            /* Not listed on platform */
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground font-semibold cursor-help">—</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-medium">Not listed on this platform</p>
                  <p className="text-muted-foreground mt-1">Not included in weighted average</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            /* Default: no data yet, not healing */
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-orange-500 font-semibold cursor-help">?</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-xs">
                  <p className="font-medium">Rating not found</p>
                  <p className="text-muted-foreground mt-1">Click refresh to fetch</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {/* Hover refresh button */}
          <button
            onClick={() => onRefreshPlatform(property, platform as Platform)}
            disabled={isThisRefreshing || isAutoHealing}
            className={cn(
              'absolute -right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 opacity-0 transition-opacity',
              'bg-background shadow-sm border border-border',
              'hover:bg-muted group-hover/cell:opacity-100',
              (isRefreshingThis || isAutoHealing) && 'opacity-100'
            )}
            title={`Refresh ${platform}`}
          >
            <RefreshCw className={cn('h-3 w-3 text-muted-foreground', (isRefreshingThis || isAutoHealing) && 'animate-spin')} />
          </button>
        </div>
      </TableCell>
    );
  };

  return (
    <TableRow className="group">
      {/* Hotel Name */}
      <TableCell className="font-medium sticky left-0 z-10 bg-card">
        <div className="flex items-center gap-1.5">
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
          <button
            onClick={() => onRefreshAllPlatforms(property)}
            disabled={isThisRefreshing}
            className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted disabled:opacity-50"
            title="Refresh all platforms"
          >
            <RefreshCw className={cn('h-3 w-3 text-muted-foreground', isThisRefreshing && 'animate-spin text-primary')} />
          </button>
        </div>
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
                {weightedAvg !== null ? weightedAvg.toFixed(2) : '—'}
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

      {/* Actions */}
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-7 gap-1 text-xs',
              hasReviewData && '!bg-amber-100 !border-amber-300 !text-amber-900 hover:!bg-amber-200 dark:!bg-amber-950/40 dark:!border-amber-700 dark:!text-amber-200 dark:hover:!bg-amber-900/50'
            )}
            onClick={() => onAnalyzeReviews(property)}
            title="Analyze reviews with AI"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Insights
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => onViewHistory(property)}
            title="View score history"
          >
            <History className="h-3.5 w-3.5" />
            History
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(property.id, property.name)}
            title="Delete property"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
