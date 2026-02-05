import { useState } from 'react';
import { Sparkles, ThumbsUp, AlertTriangle, Loader2, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useGroupReviewAnalysis } from '@/hooks/useReviewAnalysis';

interface ThemeResult {
  theme: string;
  count: number;
  quote: string;
}

interface GroupAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
}

const THEME_ICONS: Record<string, string> = {
  'clean': '🧹',
  'room': '🏨',
  'staff': '👤',
  'location': '📍',
  'breakfast': '🍳',
  'amenities': '🛁',
  'wifi': '📶',
  'parking': '🅿️',
  'noise': '🔊',
  'price': '💰',
  'service': '🛎️',
  'bed': '🛏️',
  'bathroom': '🚿',
  'view': '🌅',
  'pool': '🏊',
  'food': '🍽️',
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
  const { analyze, isAnalyzing } = useGroupReviewAnalysis(groupId);
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState<{
    positive_themes: ThemeResult[];
    negative_themes: ThemeResult[];
    summary: string;
    review_count: number;
    breakdown?: {
      positive_reviews: number;
      negative_reviews: number;
      neutral_reviews: number;
    };
  } | null>(null);

  const handleAnalyze = async () => {
    try {
      setProgress(10);
      const interval = setInterval(() => {
        setProgress(p => Math.min(p + 5, 90));
      }, 2000);

      const result = await analyze();
      
      clearInterval(interval);
      setProgress(100);

      if (result?.analysis) {
        setAnalysis(result.analysis);
        toast({
          title: 'Analysis complete',
          description: `Analyzed reviews across the group.`,
        });
      }
      
      setTimeout(() => setProgress(0), 500);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Group Review Analysis
            <span className="text-muted-foreground font-normal">
              — {groupName}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Analyzing State */}
        {isAnalyzing && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
            <div className="space-y-2">
              <p className="font-medium">Analyzing reviews with AI...</p>
              <p className="text-sm text-muted-foreground">
                This may take 15-30 seconds
              </p>
            </div>
            <Progress value={progress} className="w-64 mx-auto" />
          </div>
        )}

        {/* No Analysis Yet */}
        {!isAnalyzing && !analysis && (
          <div className="py-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Analyze Portfolio Themes</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Identify common themes across all properties in this group to understand portfolio-wide trends.
              </p>
            </div>
            <Button variant="secondary" size="lg" onClick={handleAnalyze}>
              <Sparkles className="mr-2 h-4 w-4" />
              Analyze Group Reviews
            </Button>
            <p className="text-xs text-muted-foreground">
              Requires reviews to be fetched for properties in this group first
            </p>
          </div>
        )}

        {/* Analysis Results */}
        {!isAnalyzing && analysis && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  <FileText className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">📝 Portfolio Assessment</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {analysis.summary || 'No summary available.'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      {analysis.review_count} reviews analyzed
                    </span>
                    {analysis.breakdown && (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5">
                          {analysis.breakdown.positive_reviews} positive
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 px-2 py-0.5">
                          {analysis.breakdown.negative_reviews} negative
                        </span>
                      </>
                    )}
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
                {analysis.positive_themes.length > 0 ? (
                  analysis.positive_themes.map((item, idx) => (
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
                      {item.quote && (
                        <p className="mt-2 text-sm text-muted-foreground italic border-l-2 border-emerald-300 dark:border-emerald-700 pl-3">
                          "{item.quote}"
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No positive themes found.</p>
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
                      {item.quote && (
                        <p className="mt-2 text-sm text-muted-foreground italic border-l-2 border-orange-300 dark:border-orange-700 pl-3">
                          "{item.quote}"
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No negative themes found.</p>
                )}
              </div>
            </div>

            {/* Re-analyze button */}
            <div className="pt-2 border-t">
              <Button variant="outline" size="sm" onClick={handleAnalyze}>
                <Sparkles className="mr-2 h-4 w-4" />
                Re-analyze
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
