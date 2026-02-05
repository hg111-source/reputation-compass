import { useState } from 'react';
import { 
  Sparkles, MessageSquareText, ThumbsUp, AlertTriangle, 
  Loader2, Download, RefreshCw, X, FileText
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  useReviewAnalysis, 
  useReviewCount, 
  useFetchReviews, 
  useAnalyzeReviews 
} from '@/hooks/useReviewAnalysis';
import { Property } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ReviewInsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property | null;
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

export function ReviewInsightsDialog({ 
  open, 
  onOpenChange, 
  property 
}: ReviewInsightsDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'idle' | 'fetching' | 'analyzing'>('idle');
  const [progress, setProgress] = useState(0);

  const { data: analysis, isLoading: analysisLoading, refetch: refetchAnalysis } = useReviewAnalysis(property?.id ?? null);
  const { data: reviewCount = 0 } = useReviewCount(property?.id ?? null);
  const fetchReviews = useFetchReviews();
  const analyzeReviews = useAnalyzeReviews();

  const handleFetchAndAnalyze = async () => {
    if (!property) return;

    try {
      // Step 1: Fetch reviews
      setStep('fetching');
      setProgress(10);
      
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 5, 45));
      }, 3000);

      await fetchReviews.mutateAsync({
        propertyId: property.id,
        hotelName: property.name,
        city: property.city,
        platform: 'tripadvisor',
        maxReviews: 50,
      });

      clearInterval(progressInterval);
      setProgress(50);

      // Step 2: Analyze reviews
      setStep('analyzing');
      
      const analyzeInterval = setInterval(() => {
        setProgress(p => Math.min(p + 3, 95));
      }, 1000);

      await analyzeReviews.mutateAsync({ propertyId: property.id });

      clearInterval(analyzeInterval);
      setProgress(100);

      toast({
        title: 'Analysis complete',
        description: 'Review insights are ready.',
      });

      await refetchAnalysis();
      setStep('idle');
      setProgress(0);

    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        variant: 'destructive',
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      setStep('idle');
      setProgress(0);
    }
  };

  const handleAnalyzeOnly = async () => {
    if (!property) return;

    try {
      setStep('analyzing');
      setProgress(30);
      
      const interval = setInterval(() => {
        setProgress(p => Math.min(p + 5, 95));
      }, 1000);

      await analyzeReviews.mutateAsync({ propertyId: property.id });

      clearInterval(interval);
      setProgress(100);

      toast({
        title: 'Analysis complete',
        description: 'Review insights updated.',
      });

      await refetchAnalysis();
      setStep('idle');
      setProgress(0);

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      setStep('idle');
      setProgress(0);
    }
  };

  const isProcessing = step !== 'idle';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Review Insights
            {property && (
              <span className="text-muted-foreground font-normal">
                — {property.name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Processing State */}
        {isProcessing && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
            <div className="space-y-2">
              <p className="font-medium">
                {step === 'fetching' 
                  ? 'Fetching reviews from TripAdvisor...' 
                  : 'Analyzing reviews with AI...'}
              </p>
              <p className="text-sm text-muted-foreground">
                This may take 30-60 seconds
              </p>
            </div>
            <Progress value={progress} className="w-64 mx-auto" />
          </div>
        )}

        {/* No Analysis Yet */}
        {!isProcessing && !analysis && (
          <div className="py-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <MessageSquareText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">No analysis yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Fetch and analyze reviews to discover what guests love and where you can improve.
              </p>
            </div>
            {reviewCount > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  <FileText className="inline h-4 w-4 mr-1" />
                  {reviewCount} reviews stored
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={handleAnalyzeOnly}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze Existing Reviews
                  </Button>
                  <Button variant="secondary" onClick={handleFetchAndAnalyze}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Fetch Fresh Reviews
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" size="lg" onClick={handleFetchAndAnalyze}>
                <Download className="mr-2 h-4 w-4" />
                Fetch & Analyze Reviews
              </Button>
            )}
          </div>
        )}

        {/* Analysis Results */}
        {!isProcessing && analysis && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  <FileText className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium">Summary</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {analysis.summary || 'No summary available.'}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Based on {analysis.review_count} reviews • 
                    Analyzed {format(new Date(analysis.analyzed_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            </div>

            {/* Positive Themes */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ThumbsUp className="h-5 w-5 text-emerald-500" />
                <h4 className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Positive Themes
                </h4>
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
                        <span className="text-sm text-emerald-600 dark:text-emerald-400">
                          mentioned {item.count}x
                        </span>
                      </div>
                      {item.quote && (
                        <p className="mt-1 text-sm text-muted-foreground italic">
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
                <h4 className="font-semibold text-orange-600 dark:text-orange-400">
                  Areas for Improvement
                </h4>
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
                        <span className="text-sm text-orange-600 dark:text-orange-400">
                          mentioned {item.count}x
                        </span>
                      </div>
                      {item.quote && (
                        <p className="mt-1 text-sm text-muted-foreground italic">
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

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={handleFetchAndAnalyze}>
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
