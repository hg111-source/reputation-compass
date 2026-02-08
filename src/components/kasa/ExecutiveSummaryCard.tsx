import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, Loader2, TrendingUp, BarChart3, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useExecutiveSummary } from '@/hooks/useExecutiveSummary';

interface AggregatedTheme {
  theme: string;
  totalMentions: number;
  propertyCount: number;
  topQuote: string;
}

interface PortfolioThemesResult {
  positiveThemes: AggregatedTheme[];
  negativeThemes: AggregatedTheme[];
  totalProperties: number;
  totalAnalyzed: number;
}

interface PortfolioMetrics {
  avgScore: number | null;
  totalProperties: number;
  totalReviews: number;
  veryGoodPlusPercent: number;
  exceptionalCount: number;
  belowGoodCount: number;
}

interface OTABenchmark {
  platform: string;
  kasaScore: number;
  percentile: number | null;
}

interface PropertyHighlight {
  name: string;
  city: string;
  state: string;
  score: number;
}

interface ExecutiveSummaryCardProps {
  kasaThemes: PortfolioThemesResult | null | undefined;
  compThemes: PortfolioThemesResult | null | undefined;
  portfolioMetrics: PortfolioMetrics | null;
  otaBenchmarks: OTABenchmark[];
  topPerformers: PropertyHighlight[];
  needsAttention: PropertyHighlight[];
  isLoading: boolean;
}

export function ExecutiveSummaryCard({ kasaThemes, compThemes, portfolioMetrics, otaBenchmarks, topPerformers, needsAttention, isLoading }: ExecutiveSummaryCardProps) {
  const { summary, generating, error, canGenerate, generate } = useExecutiveSummary(
    kasaThemes, compThemes, portfolioMetrics, otaBenchmarks, topPerformers, needsAttention, isLoading
  );


  return (
    <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
      <CardContent className="pt-6 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Executive Briefing</h2>
              <p className="text-xs text-muted-foreground">AI-powered portfolio intelligence</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={generate}
            disabled={!canGenerate || generating}
            className={cn(
              'gap-1.5',
              summary
                ? '!bg-amber-100 !border-amber-300 !text-amber-900 hover:!bg-amber-200 dark:!bg-amber-900/40 dark:!text-amber-300 dark:!border-amber-700'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            )}
            variant={summary ? 'outline' : 'default'}
          >
            {generating ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing…</>
            ) : summary ? (
              <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" /> Generate Briefing</>
            )}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!summary && !generating && !error && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Get a comprehensive AI briefing synthesizing all your portfolio data:
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2 rounded-md border bg-background/60 px-3 py-2">
                <TrendingUp className="h-4 w-4 text-teal-500 shrink-0" />
                <span className="text-xs font-medium">Portfolio Scores</span>
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-background/60 px-3 py-2">
                <BarChart3 className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-xs font-medium">OTA Rankings</span>
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-background/60 px-3 py-2">
                <MessageSquareText className="h-4 w-4 text-purple-500 shrink-0" />
                <span className="text-xs font-medium">Guest Sentiment</span>
              </div>
            </div>
          </div>
        )}

        {generating && !summary && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            <div className="text-center">
              <p className="text-sm font-medium">Analyzing portfolio data…</p>
              <p className="text-xs text-muted-foreground mt-0.5">Synthesizing scores, benchmarks, and guest themes</p>
            </div>
          </div>
        )}

        {summary && (
          <div className="rounded-lg border bg-background/80 p-4">
            <SummaryRenderer content={summary} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function renderBold(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part);
}

function SummaryRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  let headlineFound = false;

  return (
    <div className="space-y-0.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        // Section header: **🏆 HEADLINE** or **📊 Portfolio**
        const sectionMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
        if (sectionMatch) {
          const text = sectionMatch[1];
          if (text.includes('HEADLINE') || text.includes('🏆')) {
            headlineFound = true;
            return null;
          }
          return (
            <p key={i} className="pt-3 pb-0.5 text-xs font-bold uppercase tracking-wider text-muted-foreground first:pt-0">{text}</p>
          );
        }

        // First non-bullet after headline label = the actual headline
        if (!headlineFound || (headlineFound && !trimmed.startsWith('-') && !trimmed.startsWith('•') && i <= 3)) {
          const cleaned = trimmed.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^[""]|[""]$/g, '');
          if (cleaned.length > 10 && !headlineFound) {
            // skip
          } else if (cleaned.length > 10) {
            headlineFound = false; // consume it
            return (
              <p key={i} className="text-[15px] font-bold text-foreground leading-snug pb-2 mb-1 border-b border-amber-200 dark:border-amber-800">
                {cleaned}
              </p>
            );
          }
        }

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2 py-0.5 pl-1">
              <span className="text-muted-foreground shrink-0">•</span>
              <span>{renderBold(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Regular text
        return <p key={i}>{renderBold(trimmed)}</p>;
      })}
    </div>
  );
}
