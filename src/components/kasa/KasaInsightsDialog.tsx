import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lightbulb, Loader2, AlertTriangle, TrendingUp, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PropertyData {
  name: string;
  city: string;
  state: string;
  kasaScore: number | null;
  avgScore: number | null;
  totalReviews: number;
  google: number | null;
  tripadvisor: number | null;
  booking: number | null;
  expedia: number | null;
}

interface Insight {
  type: 'signal' | 'risk' | 'implication';
  text: string;
}

interface KasaInsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: PropertyData[];
}

const TYPE_CONFIG: Record<string, { icon: typeof TrendingUp; label: string; color: string }> = {
  signal: { icon: TrendingUp, label: 'Signal', color: 'text-emerald-600 dark:text-emerald-400' },
  risk: { icon: AlertTriangle, label: 'Risk', color: 'text-red-600 dark:text-red-400' },
  implication: { icon: BarChart3, label: 'Implication', color: 'text-blue-600 dark:text-blue-400' },
};

export function KasaInsightsDialog({ open, onOpenChange, properties }: KasaInsightsDialogProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchInsights = async () => {
    setLoading(true);
    setInsights([]);
    try {
      const { data, error } = await supabase.functions.invoke('kasa-portfolio-insights', {
        body: { properties },
      });

      if (error) throw error;
      if (data?.insights) {
        setInsights(data.insights);
      } else {
        throw new Error('No insights returned');
      }
    } catch (err: any) {
      console.error('Insights error:', err);
      toast({
        title: 'Insights failed',
        description: err.message || 'Could not generate insights.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when opened
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && insights.length === 0 && !loading) {
      fetchInsights();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Kasa Portfolio Insights
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Analyzing {properties.length} properties…</p>
            </div>
          ) : insights.length > 0 ? (
            insights.map((insight, i) => {
              const config = TYPE_CONFIG[insight.type] || TYPE_CONFIG.signal;
              const Icon = config.icon;
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30"
                >
                  <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', config.color)} />
                  <div className="flex-1 min-w-0">
                    <span className={cn('text-[10px] font-semibold uppercase tracking-wider', config.color)}>
                      {config.label}
                    </span>
                    <p className="text-sm mt-0.5 leading-snug">{insight.text}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No insights yet. Click to generate.
            </p>
          )}

          {!loading && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={fetchInsights}
            >
              <Lightbulb className="h-3.5 w-3.5 mr-1.5" />
              {insights.length > 0 ? 'Regenerate' : 'Generate Insights'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
