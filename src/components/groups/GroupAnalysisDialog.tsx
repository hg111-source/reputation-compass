import { useState } from 'react';
import { Sparkles, ThumbsUp, AlertTriangle, Loader2, FileText, RefreshCw, Brain } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useGroupReviewCount } from '@/hooks/useKeywordAnalysis';
import { useAnalyzeReviews } from '@/hooks/useReviewAnalysis';

interface GroupAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
}

const THEME_ICONS: Record<string, string> = {
  'clean': '🧹', 'staff': '👤', 'location': '📍', 'comfortable': '🛏️',
  'food': '🍽️', 'quiet': '🔇', 'spacious': '📐', 'modern': '✨',
  'cozy': '🏠', 'service': '🛎️', 'noise': '🔊', 'temperature': '🌡️',
  'price': '💰', 'room': '🚪', 'outdated': '📅', 'crowded': '👥',
  'odor': '👃', 'wifi': '📶', 'parking': '🅿️', 'pool': '🏊',
  'breakfast': '🥐', 'view': '🌅', 'default': '📝',
};

function getThemeIcon(theme: string): string {
  const lowerTheme = theme.toLowerCase();
  for (const [key, icon] of Object.entries(THEME_ICONS)) {
    if (lowerTheme.includes(key)) return icon;
  }
  return THEME_ICONS.default;
}

interface ThemeItem {
  theme: string;
  count: number;
  quote: string;
}

interface GroupAIAnalysis {
  positive_themes: ThemeItem[];
  negative_themes: ThemeItem[];
  summary: string;
  review_count: number;
}

export function GroupAnalysisDialog({ 
  open, 
  onOpenChange, 
  groupId,
  groupName,
}: GroupAnalysisDialogProps) {
  const { toast } = useToast();
  const analyzeReviews = useAnalyzeReviews();
  const { data: reviewCount = 0 } = useGroupReviewCount(groupId);
  const [analysis, setAnalysis] = useState<GroupAIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeReviews.mutateAsync({ groupId });
      if (result?.analysis) {
        setAnalysis(result.analysis);
      }
      toast({
        title: 'AI analysis complete',
        description: 'Portfolio themes have been identified.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

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
        {isAnalyzing && (
          <div className="py-8 text-center space-y-4">
            <Brain className="h-12 w-12 animate-pulse text-accent mx-auto" />
            <p className="font-medium text-lg">AI is analyzing portfolio reviews...</p>
            <p className="text-sm text-muted-foreground">Reading reviews across all properties and identifying themes</p>
          </div>
        )}

        {/* No Reviews */}
        {!isAnalyzing && reviewCount === 0 && (
          <div className="py-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">No reviews in portfolio</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Fetch reviews for individual properties first to see portfolio-wide AI analysis.
              </p>
            </div>
          </div>
        )}

        {/* Has Reviews but No Analysis Yet */}
        {!isAnalyzing && !analysis && reviewCount > 0 && (
          <div className="py-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{reviewCount} reviews available</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Run AI analysis to identify themes across your entire portfolio.
              </p>
            </div>
            <Button variant="secondary" size="lg" onClick={handleAnalyze}>
              <Brain className="mr-2 h-4 w-4" />
              Run AI Analysis
            </Button>
          </div>
        )}

        {/* Analysis Results */}
        {!isAnalyzing && analysis && (
          <div className="space-y-6">
            {/* AI Summary */}
            {analysis.summary && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <Brain className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">🤖 AI Portfolio Assessment</p>
                    <p className="mt-1 text-sm text-muted-foreground">{analysis.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                        {analysis.review_count} reviews analyzed
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                        Powered by Gemini
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Positive Themes */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ThumbsUp className="h-5 w-5 text-emerald-500" />
                <h4 className="font-semibold">✅ Portfolio Strengths</h4>
              </div>
              <div className="space-y-2">
                {analysis.positive_themes.length > 0 ? (
                  analysis.positive_themes.map((item, idx) => (
                    <div key={idx} className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium flex items-center gap-2">
                          <span>{getThemeIcon(item.theme)}</span>
                          {item.theme}
                        </span>
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {item.count} mentions
                        </span>
                      </div>
                      {item.quote && (
                        <p className="mt-2 text-sm text-muted-foreground italic border-l-2 border-emerald-300 dark:border-emerald-700 pl-3 line-clamp-2">
                          "{item.quote}"
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">No positive themes detected.</p>
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
                {analysis.negative_themes.length > 0 ? (
                  analysis.negative_themes.map((item, idx) => (
                    <div key={idx} className="rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium flex items-center gap-2">
                          <span>{getThemeIcon(item.theme)}</span>
                          {item.theme}
                        </span>
                        <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                          {item.count} mentions
                        </span>
                      </div>
                      {item.quote && (
                        <p className="mt-2 text-sm text-muted-foreground italic border-l-2 border-orange-300 dark:border-orange-700 pl-3 line-clamp-2">
                          "{item.quote}"
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">No negative themes detected.</p>
                )}
              </div>
            </div>

            {/* Re-analyze button */}
            <div className="pt-2 border-t">
              <Button variant="outline" size="sm" onClick={handleAnalyze}>
                <Brain className="mr-2 h-4 w-4" />
                Re-analyze with AI
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
