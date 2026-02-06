import { useState } from 'react';
import { 
  Sparkles, MessageSquareText, ThumbsUp, AlertTriangle, 
  Loader2, Download, RefreshCw, FileText, CheckCircle2
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
import { supabase } from '@/integrations/supabase/client';
import { 
  usePropertyKeywordAnalysis, 
  usePropertyReviewCount 
} from '@/hooks/useKeywordAnalysis';
import { Property } from '@/lib/types';
import { useQueryClient } from '@tanstack/react-query';

interface ReviewInsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property | null;
}

type FetchStep = 'idle' | 'tripadvisor' | 'google' | 'analyzing' | 'complete';

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

const STEP_MESSAGES: Record<FetchStep, string> = {
  idle: '',
  tripadvisor: 'Fetching TripAdvisor reviews...',
  google: 'Fetching Google reviews...',
  analyzing: 'Analyzing keyword patterns...',
  complete: 'Analysis complete!',
};

export function ReviewInsightsDialog({ 
  open, 
  onOpenChange, 
  property 
}: ReviewInsightsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<FetchStep>('idle');
  const [progress, setProgress] = useState(0);
  const [platformResults, setPlatformResults] = useState<{ platform: string; count: number }[]>([]);

  const { data: analysis, isLoading: analysisLoading, refetch: refetchAnalysis } = usePropertyKeywordAnalysis(property?.id ?? null);
  const { data: reviewCount = 0 } = usePropertyReviewCount(property?.id ?? null);

  const handleFetchReviews = async () => {
    if (!property) return;

    try {
      setPlatformResults([]);
      
      // Step 1: Fetch TripAdvisor reviews
      setStep('tripadvisor');
      setProgress(10);
      
      const tripResponse = await supabase.functions.invoke('fetch-reviews', {
        body: { 
          propertyId: property.id,
          hotelName: property.name,
          city: property.city,
          platform: 'tripadvisor',
          maxReviews: 25,
        },
      });

      if (tripResponse.data?.platforms) {
        setPlatformResults(prev => [...prev, ...tripResponse.data.platforms]);
      }
      setProgress(35);

      // Step 2: Fetch Google reviews
      setStep('google');
      
      const googleResponse = await supabase.functions.invoke('fetch-reviews', {
        body: { 
          propertyId: property.id,
          hotelName: property.name,
          city: property.city,
          platform: 'google',
          maxReviews: 25,
        },
      });

      if (googleResponse.data?.platforms) {
        setPlatformResults(prev => [...prev, ...googleResponse.data.platforms]);
      }
      setProgress(70);

      // Step 3: Analyze with keywords
      setStep('analyzing');
      setProgress(85);

      // Invalidate and refetch keyword analysis
      await queryClient.invalidateQueries({ queryKey: ['keyword-analysis', property.id] });
      await queryClient.invalidateQueries({ queryKey: ['review-count', property.id] });
      await refetchAnalysis();

      setProgress(100);
      setStep('complete');

      const totalReviews = platformResults.reduce((sum, p) => sum + p.count, 0) + 
        (tripResponse.data?.reviewCount || 0) + (googleResponse.data?.reviewCount || 0);

      toast({
        title: 'Reviews fetched & analyzed',
        description: `Found ${totalReviews} reviews across platforms.`,
      });

      // Reset after a moment
      setTimeout(() => {
        setStep('idle');
        setProgress(0);
      }, 1500);

    } catch (error) {
      console.error('Fetch error:', error);
      toast({
        variant: 'destructive',
        title: 'Fetch failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      setStep('idle');
      setProgress(0);
    }
  };

  const handleRefreshAnalysis = () => {
    refetchAnalysis();
    toast({
      title: 'Analysis refreshed',
      description: 'Keyword counts have been recalculated.',
    });
  };

  const isFetching = step !== 'idle' && step !== 'complete';

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

        {/* Fetching State */}
        {isFetching && (
          <div className="py-8 space-y-6">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto" />
              <div className="space-y-2">
                <p className="font-medium text-lg">{STEP_MESSAGES[step]}</p>
                <p className="text-sm text-muted-foreground">
                  This may take 60-90 seconds per platform
                </p>
              </div>
            </div>
            
            <Progress value={progress} className="w-64 mx-auto" />

            {/* Progress steps */}
            <div className="max-w-xs mx-auto space-y-2">
              <div className="flex items-center gap-3 text-sm">
                {step === 'tripadvisor' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                ) : platformResults.some(p => p.platform === 'tripadvisor') ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted" />
                )}
                <span className={step === 'tripadvisor' ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                  TripAdvisor reviews
                  {platformResults.find(p => p.platform === 'tripadvisor')?.count !== undefined && (
                    <span className="ml-2 text-emerald-600">
                      ({platformResults.find(p => p.platform === 'tripadvisor')?.count} found)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {step === 'google' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                ) : platformResults.some(p => p.platform === 'google') ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted" />
                )}
                <span className={step === 'google' ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                  Google reviews
                  {platformResults.find(p => p.platform === 'google')?.count !== undefined && (
                    <span className="ml-2 text-emerald-600">
                      ({platformResults.find(p => p.platform === 'google')?.count} found)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {step === 'analyzing' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted" />
                )}
                <span className={step === 'analyzing' ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                  Keyword analysis
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Complete State (brief) */}
        {step === 'complete' && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <p className="font-medium text-lg">Analysis complete!</p>
          </div>
        )}

        {/* No Reviews Yet */}
        {step === 'idle' && !analysis && reviewCount === 0 && (
          <div className="py-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <MessageSquareText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">No reviews yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Fetch reviews to discover what guests love and where you can improve.
              </p>
            </div>
            <Button variant="secondary" size="lg" onClick={handleFetchReviews}>
              <Download className="mr-2 h-4 w-4" />
              Fetch Reviews
            </Button>
            <p className="text-xs text-muted-foreground">
              Fetches ~25 recent reviews from TripAdvisor & Google
            </p>
          </div>
        )}

        {/* Has Reviews but No Significant Keywords */}
        {step === 'idle' && !analysis && reviewCount > 0 && (
          <div className="py-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{reviewCount} reviews stored</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                No significant keyword patterns detected. Try fetching fresh reviews.
              </p>
            </div>
            <Button variant="secondary" onClick={handleFetchReviews}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Fetch Fresh Reviews
            </Button>
          </div>
        )}

        {/* Analysis Results */}
        {(step === 'idle' || step === 'complete') && analysis && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  <FileText className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">📊 Keyword Analysis</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Analyzed {analysis.totalReviews} reviews for common themes and patterns.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
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
                <h4 className="font-semibold">✅ What Guests Love</h4>
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
                    No positive keyword patterns detected.
                  </p>
                )}
              </div>
            </div>

            {/* Negative Themes */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <h4 className="font-semibold">⚠️ Areas for Improvement</h4>
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
                    No negative keyword patterns detected.
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={handleFetchReviews}>
                <Download className="mr-2 h-4 w-4" />
                Fetch Fresh Reviews
              </Button>
              <Button variant="ghost" size="sm" onClick={handleRefreshAnalysis}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Recalculate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
