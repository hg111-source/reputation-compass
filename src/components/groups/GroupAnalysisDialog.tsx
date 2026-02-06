import { useState } from 'react';
import { Sparkles, ThumbsUp, AlertTriangle, Loader2, FileText, RefreshCw, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  useGroupKeywordAnalysis, 
  useGroupReviewCount 
} from '@/hooks/useKeywordAnalysis';
import { useQueryClient } from '@tanstack/react-query';

interface GroupAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
}

const THEME_ICONS: Record<string, string> = {
  'clean': '🧹',
  'staff': '👤',
  'location': '📍',
  'comfortable': '🛏️',
  'food': '🍽️',
  'quiet': '🔇',
  'spacious': '📐',
  'modern': '✨',
  'cozy': '🏠',
  'service': '🛎️',
  'noise': '🔊',
  'temperature': '🌡️',
  'price': '💰',
  'room': '🚪',
  'outdated': '📅',
  'crowded': '👥',
  'odor': '👃',
  'default': '📝',
};

function getThemeIcon(theme: string): string {
  const lowerTheme = theme.toLowerCase();
  for (const [key, icon] of Object.entries(THEME_ICONS)) {
    if (lowerTheme.includes(key)) return icon;
  }
  return THEME_ICONS.default;
}

export function GroupAnalysisDialog({ 
  open, 
  onOpenChange, 
  groupId,
  groupName,
}: GroupAnalysisDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: analysis, isLoading, refetch } = useGroupKeywordAnalysis(groupId);
  const { data: reviewCount = 0 } = useGroupReviewCount(groupId);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['group-keyword-analysis', groupId] });
    refetch();
    toast({
      title: 'Analysis refreshed',
      description: 'Portfolio keyword analysis has been recalculated.',
    });
  };

  // Generate portfolio summary from themes
  const getPortfolioSummary = () => {
    if (!analysis) return null;
    
    const strengths = analysis.positiveThemes.slice(0, 3).map(t => t.theme);
    const concerns = analysis.negativeThemes.slice(0, 3).map(t => t.theme);
    
    return { strengths, concerns };
  };

  const summary = getPortfolioSummary();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Portfolio Review Analysis
            <span className="text-muted-foreground font-normal">
              — {groupName}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Loading State */}
        {isLoading && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
            <p className="text-muted-foreground">Analyzing reviews across portfolio...</p>
          </div>
        )}

        {/* No Reviews */}
        {!isLoading && reviewCount === 0 && (
          <div className="py-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">No reviews in portfolio</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Fetch reviews for individual properties first to see portfolio-wide analysis.
              </p>
            </div>
          </div>
        )}

        {/* Has Reviews but No Patterns */}
        {!isLoading && !analysis && reviewCount > 0 && (
          <div className="py-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{reviewCount} reviews available</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                No significant keyword patterns detected across the portfolio.
              </p>
            </div>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Analysis
            </Button>
          </div>
        )}

        {/* Analysis Results */}
        {!isLoading && analysis && (
          <div className="space-y-6">
            {/* Portfolio Summary */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  <FileText className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">📊 Portfolio Assessment</p>
                  <div className="mt-3 space-y-2">
                    {summary && summary.strengths.length > 0 && (
                      <p className="text-sm">
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          Portfolio Strengths:
                        </span>{' '}
                        <span className="text-muted-foreground">
                          {summary.strengths.join(', ')}
                        </span>
                      </p>
                    )}
                    {summary && summary.concerns.length > 0 && (
                      <p className="text-sm">
                        <span className="font-medium text-orange-600 dark:text-orange-400">
                          Portfolio Concerns:
                        </span>{' '}
                        <span className="text-muted-foreground">
                          {summary.concerns.join(', ')}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      {analysis.totalReviews} reviews analyzed
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Positive Themes */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ThumbsUp className="h-5 w-5 text-emerald-500" />
                <h4 className="font-semibold">✅ Portfolio Strengths</h4>
              </div>
              <div className="space-y-2">
                {analysis.positiveThemes.length > 0 ? (
                  analysis.positiveThemes.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium flex items-center gap-2">
                          <span>{getThemeIcon(item.theme)}</span>
                          {item.theme}
                        </span>
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {item.count} mentions
                        </span>
                      </div>
                      {item.exampleReview && (
                        <p className="mt-2 text-sm text-muted-foreground italic border-l-2 border-emerald-300 dark:border-emerald-700 pl-3 line-clamp-2">
                          "{item.exampleReview}..."
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No positive patterns detected across portfolio.
                  </p>
                )}
              </div>
            </div>

            {/* Negative Themes */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <h4 className="font-semibold">⚠️ Portfolio-Wide Issues</h4>
              </div>
              <div className="space-y-2">
                {analysis.negativeThemes.length > 0 ? (
                  analysis.negativeThemes.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium flex items-center gap-2">
                          <span>{getThemeIcon(item.theme)}</span>
                          {item.theme}
                        </span>
                        <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                          {item.count} mentions
                        </span>
                      </div>
                      {item.exampleReview && (
                        <p className="mt-2 text-sm text-muted-foreground italic border-l-2 border-orange-300 dark:border-orange-700 pl-3 line-clamp-2">
                          "{item.exampleReview}..."
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No negative patterns detected across portfolio.
                  </p>
                )}
              </div>
            </div>

            {/* Re-analyze button */}
            <div className="pt-2 border-t">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Analysis
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
