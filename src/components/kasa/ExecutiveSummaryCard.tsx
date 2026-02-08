import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, Loader2, TrendingUp, BarChart3, MessageSquareText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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

interface ExecutiveSummaryCardProps {
  kasaThemes: PortfolioThemesResult | null | undefined;
  compThemes: PortfolioThemesResult | null | undefined;
  portfolioMetrics: PortfolioMetrics | null;
  otaBenchmarks: OTABenchmark[];
  isLoading: boolean;
}

function formatThemesSection(label: string, data: PortfolioThemesResult): string {
  const pos = data.positiveThemes.slice(0, 5).map(t => `  - "${t.theme}" (${t.totalMentions} mentions, ${t.propertyCount} properties)`).join('\n');
  const neg = data.negativeThemes.slice(0, 5).map(t => `  - "${t.theme}" (${t.totalMentions} mentions, ${t.propertyCount} properties)`).join('\n');
  return `${label} Guest Themes (${data.totalAnalyzed}/${data.totalProperties} properties analyzed):\n  Strengths:\n${pos}\n  Pain Points:\n${neg}`;
}

export function ExecutiveSummaryCard({ kasaThemes, compThemes, portfolioMetrics, otaBenchmarks, isLoading }: ExecutiveSummaryCardProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = !isLoading && (kasaThemes || compThemes || portfolioMetrics);

  const generate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setError(null);

    try {
      const sections: string[] = [];

      // Portfolio score overview
      if (portfolioMetrics && portfolioMetrics.avgScore !== null) {
        sections.push(`PORTFOLIO OVERVIEW:
- ${portfolioMetrics.totalProperties} Kasa properties, average score: ${portfolioMetrics.avgScore.toFixed(2)}/10
- ${portfolioMetrics.veryGoodPlusPercent}% rated "Very Good" (8.0) or higher
- ${portfolioMetrics.exceptionalCount} properties scoring 9.5+ ("Exceptional")
- ${portfolioMetrics.belowGoodCount} properties below 7.0 needing attention
- ${portfolioMetrics.totalReviews.toLocaleString()} total guest reviews`);
      }

      // OTA benchmarks
      if (otaBenchmarks.length > 0) {
        const otaLines = otaBenchmarks
          .filter(b => b.percentile !== null)
          .map(b => `  - ${b.platform}: ${b.kasaScore.toFixed(2)}/10 (Top ${Math.max(1, Math.round(100 - b.percentile!))}%)`)
          .join('\n');
        if (otaLines) {
          sections.push(`OTA CHANNEL BENCHMARKS (vs. competitor properties):\n${otaLines}`);
        }
      }

      // Guest themes
      if (kasaThemes) sections.push(formatThemesSection('Kasa', kasaThemes));
      if (compThemes) sections.push(formatThemesSection('Competitor', compThemes));

      const prompt = `You are a hospitality industry strategist specializing in tech-enabled accommodation brands.

CRITICAL CONTEXT about Kasa:
- Kasa is a TECH-ENABLED hospitality company — NOT a traditional hotel chain
- Kasa properties have NO on-site front desk staff and NO traditional concierge
- Guest communication is primarily digital (app, SMS, automated messaging)
- Check-in is fully self-service (keyless entry, digital guides)
- Kasa competes with traditional hotels on quality but with a lean, scalable tech model
- Recommendations should focus on technology, digital experience, automation, and operational efficiency — NOT hiring staff or in-person service training

Below is a comprehensive portfolio analysis covering scores, OTA channel rankings, and guest sentiment themes:

${sections.join('\n\n')}

Write a COMPREHENSIVE executive briefing:
1. **Lead with the headline** — one bold sentence capturing the portfolio's position
2. **Portfolio Health** — 1-2 bullets on score distribution and standout metrics
3. **Channel Performance** — 1-2 bullets on OTA rankings and where Kasa dominates or trails
4. **Guest Sentiment** — 1-2 bullets on the strongest themes (positive & negative) vs. competitors
5. **Top Recommendation** — one concrete, actionable next step relevant to Kasa's tech-enabled model

Rules:
- Use specific numbers from the data
- Keep total under 250 words
- Use markdown formatting (bold headers, bullet points)
- Do NOT suggest hiring staff or traditional hotel service programs`;

      const { data, error: fnError } = await supabase.functions.invoke('analyze-executive-summary', {
        body: { prompt },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setGenerating(false);
    }
  };

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

function SummaryRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const boldMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
        if (boldMatch) return <p key={i} className="font-bold text-foreground text-base">{boldMatch[1]}</p>;
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          const text = trimmed.slice(2);
          return (
            <div key={i} className="flex gap-2 text-sm">
              <span className="text-muted-foreground mt-0.5">•</span>
              <span dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          );
        }
        return <p key={i} className="text-sm" dangerouslySetInnerHTML={{ __html: trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />;
      })}
    </div>
  );
}
