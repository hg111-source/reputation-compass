import { MapPin, Trash2, RefreshCw, ExternalLink, History, Sparkles, AlertCircle, FolderOpen } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Property, ReviewSource } from '@/lib/types';
import { 
  getScoreColor, 
  formatScore, 
  REVIEW_SOURCES,
  calculatePropertyMetrics 
} from '@/lib/scoring';
import { Platform } from '@/hooks/useUnifiedRefresh';

interface PlatformScore {
  score: number;
  count: number;
  updated: string;
}

interface PropertyRowProps {
  property: Property;
  scores: Record<ReviewSource, PlatformScore> | undefined;
  groups: string[];
  onDelete: (id: string, name: string) => void;
  onRefreshPlatform: (property: Property, platform: Platform) => void;
  onRefreshAllPlatforms: (property: Property) => void;
  onViewHistory: (property: Property) => void;
  onAnalyzeReviews: (property: Property) => void;
  isRefreshing: boolean;
  currentPlatform: Platform | null;
}

export function PropertyRow({
  property,
  scores,
  groups,
  onDelete,
  onRefreshPlatform,
  onRefreshAllPlatforms,
  onViewHistory,
  onAnalyzeReviews,
  isRefreshing,
  currentPlatform,
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

  const renderPlatformCell = (platform: ReviewSource) => {
    const data = scores?.[platform];
    const isRefreshingThis = isRefreshing && currentPlatform === platform;
    
    // Check if URL is missing for OTA platforms
    const hasUrl = platform === 'google' 
      ? !!property.google_place_id 
      : platform === 'booking' 
        ? !!property.booking_url 
        : platform === 'tripadvisor' 
          ? !!property.tripadvisor_url 
          : !!property.expedia_url;
    
    const showMissingUrlWarning = !hasUrl && platform !== 'google';

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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-orange-500 font-semibold cursor-help">?</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-xs">
                  <p className="font-medium">
                    {showMissingUrlWarning ? 'Missing platform URL' : 'Rating not found'}
                  </p>
                  <p className="text-muted-foreground mt-1">
                    {showMissingUrlWarning 
                      ? 'Click the refresh button to auto-resolve and fetch ratings'
                      : 'Not included in weighted average'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {/* Hover refresh button */}
          <button
            onClick={() => onRefreshPlatform(property, platform as Platform)}
            disabled={isRefreshing}
            className={cn(
              'absolute -right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 opacity-0 transition-opacity',
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
            disabled={isRefreshing}
            className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted disabled:opacity-50"
            title="Refresh all platforms"
          >
            <RefreshCw className={cn('h-3 w-3 text-muted-foreground', isRefreshing && 'animate-spin text-primary')} />
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

      {/* Groups */}
      <TableCell>
        {groups.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {groups.slice(0, 2).map((group) => (
              <Badge key={group} variant="secondary" className="text-xs">
                {group}
              </Badge>
            ))}
            {groups.length > 2 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs cursor-help">
                      +{groups.length - 2}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">All groups:</p>
                    <p className="text-xs text-muted-foreground">{groups.join(', ')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
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
            className="h-7 gap-1 text-xs"
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
