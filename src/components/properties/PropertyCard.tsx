import { MapPin, RefreshCw, ExternalLink, Sparkles, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Property, ReviewSource } from '@/lib/types';
import { 
  getScoreColor, 
  formatScore, 
  REVIEW_SOURCES,
  SOURCE_LABELS,
  calculatePropertyMetrics 
} from '@/lib/scoring';
import { Platform } from '@/hooks/useUnifiedRefresh';
import googleLogo from '@/assets/logos/google.svg';
import tripadvisorLogo from '@/assets/logos/tripadvisor.png';
import bookingLogo from '@/assets/logos/booking.png';
import expediaLogo from '@/assets/logos/expedia.png';

const platformLogos: Partial<Record<ReviewSource, string>> = {
  google: googleLogo,
  tripadvisor: tripadvisorLogo,
  booking: bookingLogo,
  expedia: expediaLogo,
};

interface PlatformScore {
  score: number;
  count: number;
  updated: string;
}

interface PropertyCardProps {
  property: Property;
  scores: Record<ReviewSource, PlatformScore> | undefined;
  onDelete: (id: string, name: string) => void;
  onRefreshAllPlatforms: (property: Property) => void;
  onViewHistory: (property: Property) => void;
  onAnalyzeReviews: (property: Property) => void;
  isRefreshing: boolean;
}

export function PropertyCard({
  property,
  scores,
  onDelete,
  onRefreshAllPlatforms,
  onViewHistory,
  onAnalyzeReviews,
  isRefreshing,
}: PropertyCardProps) {
  const { avgScore: weightedAvg, totalReviews } = calculatePropertyMetrics(scores);

  const getHotelLink = () => {
    if (property.website_url) return property.website_url;
    const query = encodeURIComponent(`${property.name} hotel ${property.city} ${property.state}`);
    return `https://www.google.com/search?q=${query}`;
  };

  return (
    <Card className="shadow-kasa hover:shadow-kasa-hover transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <a
              href={getHotelLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-semibold hover:text-primary hover:underline transition-colors line-clamp-1"
            >
              {property.name}
              {property.website_url && (
                <ExternalLink className="inline ml-1 h-3 w-3 text-muted-foreground/50" />
              )}
            </a>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <MapPin className="h-3.5 w-3.5" />
              {property.city}, {property.state}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onDelete(property.id, property.name)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weighted Average - Primary */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Weighted Average</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn('text-3xl font-bold cursor-help', getScoreColor(weightedAvg))}>
                    {weightedAvg !== null ? weightedAvg.toFixed(2) : '—'}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">Σ(score × reviews) ÷ Σ(reviews)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-medium">Total Reviews</p>
            <p className="text-2xl font-bold">{totalReviews.toLocaleString()}</p>
          </div>
        </div>

        {/* Platform Scores Grid */}
        <div className="grid grid-cols-2 gap-2">
          {REVIEW_SOURCES.map(source => {
            const data = scores?.[source];
            return (
              <div 
                key={source} 
                className="flex items-center gap-2 p-2 rounded-md bg-muted/30"
              >
                <img 
                  src={platformLogos[source]} 
                  alt={SOURCE_LABELS[source]} 
                  className="h-4 w-4 object-contain"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{SOURCE_LABELS[source]}</p>
                  {data && data.score > 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className={cn('font-semibold text-sm', getScoreColor(data.score))}>
                        {formatScore(data.score)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({data.count.toLocaleString()})
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-orange-500 font-medium">?</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => onRefreshAllPlatforms(property)}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('mr-1 h-3 w-3', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => onAnalyzeReviews(property)}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            Insights
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
