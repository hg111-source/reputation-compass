import { useState } from 'react';
import { 
  Sparkles, MessageSquareText, ThumbsUp, AlertTriangle, 
  Loader2, Download, RefreshCw, FileText, CheckCircle2, Brain
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
import { useReviewAnalysis, useReviewCount, useAnalyzeReviews } from '@/hooks/useReviewAnalysis';
import { Property } from '@/lib/types';
import { useQueryClient } from '@tanstack/react-query';

interface ReviewInsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property | null;
}

type FetchStep = 'idle' | 'fetching-reviews' | 'ai-analysis' | 'complete';

const THEME_ICONS: Record<string, string> = {
  'clean': '🧹', 'staff': '👤', 'location': '📍', 'comfortable': '🛏️',
  'food': '🍽️', 'quiet': '🔇', 'spacious': '📐', 'modern': '✨',
  'cozy': '🏠', 'service': '🛎️', 'noise': '🔊', 'temperature': '🌡️',
  'price': '💰', 'room': '🚪', 'outdated': '📅', 'crowded': '👥',
  'odor': '👃', 'wifi': '📶', 'parking': '🅿️', 'pool': '🏊',
  'breakfast': '🥐', 'view': '🌅', 'bathroom': '🚿', 'bed': '🛏️',
  'check': '📋', 'default': '📝',
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
  'fetching-reviews': 'Fetching reviews from Google & Expedia...',
  'ai-analysis': 'AI is analyzing themes & sentiment...',
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

  const { data: analysis, isLoading: analysisLoading, refetch: refetchAnalysis } = useReviewAnalysis(property?.id ?? null);
  const { data: reviewCount = 0 } = useReviewCount(property?.id ?? null);
  const analyzeReviews = useAnalyzeReviews();

  const handleFetchAndAnalyze = async () => {
    if (!property) return;

    try {
      setPlatformResults([]);
      const warnings: string[] = [];
      
      // Step 1: Fetch all reviews in parallel (Google + Expedia)
      setStep('fetching-reviews');
      setProgress(15);
      
      const response = await supabase.functions.invoke('fetch-reviews', {
        body: { 
          propertyId: property.id,
          hotelName: property.name,
          city: property.city,
          platform: 'all',
          maxReviews: 25,
        },
      });

      if (response.data?.platforms) {
        setPlatformResults(response.data.platforms);
      }
      if (response.data?.saveErrors?.length > 0) {
        for (const e of response.data.saveErrors) {
          warnings.push(`${e.platform} save failed: ${e.error}`);
        }
      }
      if (response.data?.fetchErrors?.length > 0) {
        for (const e of response.data.fetchErrors) {
          warnings.push(`${e.platform} fetch failed: ${e.error}`);
        }
      }
      setProgress(60);

      // Verify reviews actually persisted before running AI
      const { count: savedCount } = await supabase
        .from('review_texts')
        .select('*', { count: 'exact', head: true })
        .eq('property_id', property.id);

      if (!savedCount || savedCount === 0) {
        toast({
          variant: 'destructive',
          title: 'Reviews not saved',
          description: 'Reviews were fetched but failed to save to the database. Please try again.',
        });
        setStep('idle');
        setProgress(0);
        return;
      }

      // Show warnings if any save issues occurred but some reviews persisted
      if (warnings.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Partial save issues',
          description: warnings.join('. '),
        });
      }

      // Step 3: AI-powered theme analysis via Lovable AI
      setStep('ai-analysis');
      setProgress(75);

      await analyzeReviews.mutateAsync({ propertyId: property.id });
      
      // Verify analysis was cached
      const { data: cachedAnalysis } = await supabase
        .from('review_analysis')
        .select('id')
        .eq('property_id', property.id)
        .maybeSingle();

      if (!cachedAnalysis) {
        toast({
          variant: 'destructive',
          title: 'Analysis cache warning',
          description: 'AI analysis completed but may not have been saved. Results are shown below but may not persist.',
        });
      }

      // Refresh cached data
      await queryClient.invalidateQueries({ queryKey: ['review-analysis', property.id] });
      await queryClient.invalidateQueries({ queryKey: ['review-texts-count', property.id] });
      await queryClient.invalidateQueries({ queryKey: ['properties-with-reviews'] });
      await refetchAnalysis();

      setProgress(100);
      setStep('complete');

      toast({
        title: 'AI analysis complete',
        description: `Analyzed ${savedCount} reviews and identified key themes.`,
      });

      setTimeout(() => {
        setStep('idle');
        setProgress(0);
      }, 1500);

    } catch (error) {
      console.error('Fetch error:', error);
      toast({
        variant: 'destructive',
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'Unknown error. Please try again.',
      });
      setStep('idle');
      setProgress(0);
    }
  };

  const handleReanalyze = async () => {
    if (!property) return;
    try {
      await analyzeReviews.mutateAsync({ propertyId: property.id });
      await refetchAnalysis();
      toast({
        title: 'Re-analysis complete',
        description: 'AI has re-analyzed existing reviews for updated themes.',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      // Don't show destructive toast for "no reviews" — it's expected
      if (msg.includes('No reviews found')) {
        toast({
          title: 'No reviews available',
          description: 'Fetch reviews first using "Fetch & Analyze Reviews" below.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Re-analysis failed',
          description: msg,
        });
      }
    }
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
                  {step === 'ai-analysis' ? 'AI is reading reviews and identifying patterns...' : 'Fetching from all platforms in parallel...'}
                </p>
              </div>
            </div>
            
            <Progress value={progress} className="w-64 mx-auto" />

            <div className="max-w-xs mx-auto space-y-2">
              <div className="flex items-center gap-3 text-sm">
                {step === 'fetching-reviews' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                <span className={step === 'fetching-reviews' ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                  Google & Expedia reviews
                  {platformResults.length > 0 && (
                    <span className="ml-2 text-emerald-600">
                      ({platformResults.reduce((sum, p) => sum + p.count, 0)} found)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {step === 'ai-analysis' ? (
                  <Brain className="h-4 w-4 animate-pulse text-accent" />
                ) : step === 'fetching-reviews' ? (
                  <div className="h-4 w-4 rounded-full border-2 border-muted" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                <span className={step === 'ai-analysis' ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                  AI theme analysis
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Complete State */}
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
                Fetch reviews and let AI identify what guests love and where to improve.
              </p>
            </div>
            <Button variant="secondary" size="lg" onClick={handleFetchAndAnalyze}>
              <Download className="mr-2 h-4 w-4" />
              Fetch & Analyze Reviews
            </Button>
            <p className="text-xs text-muted-foreground">
              Fetches reviews from Google & Expedia, then runs AI theme analysis
            </p>
          </div>
        )}

        {/* Has Reviews but No AI Analysis */}
        {step === 'idle' && !analysis && reviewCount > 0 && (
          <div className="py-8 text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{reviewCount} reviews stored</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Reviews are available but haven't been analyzed by AI yet.
              </p>
            </div>
            <Button variant="secondary" onClick={handleReanalyze} disabled={analyzeReviews.isPending}>
              {analyzeReviews.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
              Run AI Analysis
            </Button>
          </div>
        )}

        {/* AI Analysis Results */}
        {(step === 'idle' || step === 'complete') && analysis && (
          <div className="space-y-6">
            {/* AI Summary */}
            {analysis.summary && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <Brain className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium flex items-center gap-2">
                      🤖 AI Summary
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {analysis.summary}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
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
            <ThemeSection
              title="What Guests Love"
              icon={<ThumbsUp className="h-5 w-5 text-emerald-500" />}
              emoji="✅"
              themes={analysis.positive_themes}
              colorScheme="emerald"
            />

            {/* Negative Themes */}
            <ThemeSection
              title="Areas for Improvement"
              icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
              emoji="⚠️"
              themes={analysis.negative_themes}
              colorScheme="orange"
            />

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={handleFetchAndAnalyze}>
                <Download className="mr-2 h-4 w-4" />
                Fetch Fresh Reviews
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReanalyze} disabled={analyzeReviews.isPending}>
                {analyzeReviews.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                Re-analyze
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}



interface ThemeItem {
  theme: string;
  count: number;
  quote: string;
}

function ThemeSection({ title, icon, emoji, themes, colorScheme }: {
  title: string;
  icon: React.ReactNode;
  emoji: string;
  themes: ThemeItem[];
  colorScheme: 'emerald' | 'orange';
}) {
  const borderClass = colorScheme === 'emerald' 
    ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30'
    : 'border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30';
  const countClass = colorScheme === 'emerald'
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-orange-600 dark:text-orange-400';
  const quoteClass = colorScheme === 'emerald'
    ? 'border-emerald-300 dark:border-emerald-700'
    : 'border-orange-300 dark:border-orange-700';

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="font-semibold">{emoji} {title}</h4>
      </div>
      <div className="space-y-2">
        {themes.length > 0 ? (
          themes.map((item, idx) => (
            <div key={idx} className={`rounded-lg border p-3 ${borderClass}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium flex items-center gap-2">
                  <span>{getThemeIcon(item.theme)}</span>
                  {item.theme}
                </span>
                <span className={`text-sm font-medium ${countClass}`}>
                  {item.count} mentions
                </span>
              </div>
              {item.quote && (
                <p className={`mt-2 text-sm text-muted-foreground italic border-l-2 pl-3 line-clamp-2 ${quoteClass}`}>
                  "{item.quote}"
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No {colorScheme === 'emerald' ? 'positive' : 'negative'} themes detected.
          </p>
        )}
      </div>
    </div>
  );
}
