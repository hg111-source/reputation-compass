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

function formatThemesSection(label: string, data: PortfolioThemesResult): string {
  const pos = data.positiveThemes.slice(0, 5).map(t => `  - "${t.theme}" (${t.totalMentions} mentions, ${t.propertyCount} properties)`).join('\n');
  const neg = data.negativeThemes.slice(0, 5).map(t => `  - "${t.theme}" (${t.totalMentions} mentions, ${t.propertyCount} properties)`).join('\n');
  return `${label} Guest Themes (${data.totalAnalyzed}/${data.totalProperties} properties analyzed):\n  Strengths:\n${pos}\n  Pain Points:\n${neg}`;
}

export function ExecutiveSummaryCard({ kasaThemes, compThemes, portfolioMetrics, otaBenchmarks, topPerformers, needsAttention, isLoading }: ExecutiveSummaryCardProps) {
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

      // Top performers & needs attention
      if (topPerformers.length > 0) {
        const lines = topPerformers.slice(0, 5).map(p => `  - ${p.name} (${p.city}, ${p.state}): ${p.score.toFixed(2)}/10`).join('\n');
        sections.push(`TOP PERFORMERS (9.5+):\n${lines}`);
      }
      if (needsAttention.length > 0) {
        const lines = needsAttention.slice(0, 5).map(p => `  - ${p.name} (${p.city}, ${p.state}): ${p.score.toFixed(2)}/10`).join('\n');
        sections.push(`NEEDS ATTENTION (<7.0):\n${lines}`);
      }

      // Guest themes
      if (kasaThemes) sections.push(formatThemesSection('Kasa', kasaThemes));
      if (compThemes) sections.push(formatThemesSection('Competitor', compThemes));

      const prompt = `You are a hospitality industry strategist. Write a scannable executive briefing.

CONTEXT: Kasa is a tech-enabled hospitality company with NO on-site staff. Digital-first (app, SMS, keyless entry). Never suggest hiring staff.

DATA:
${sections.join('\n\n')}

FORMAT (use exactly these section headers with emojis):

**🏆 HEADLINE**
One punchy sentence with the single most important number. Make it bold, specific, provocative. Example style: "Kasa ranks Top 4% on Google across 79 properties — but Booking.com is a blind spot."

**📊 Portfolio**
- One short bullet: avg score, % Very Good+
- One short bullet: standout or concern

**📡 Channels**
- One bullet per channel: score + percentile rank. Use ✅ for Top 10%, ⚠️ for below Top 25%

**💬 Guests Say**
- Top positive theme: name + Kasa % vs Comp %
- Top negative theme: name + Kasa % vs Comp %

**🎯 #1 Action**
One sentence. Specific. Tech-focused. Tied to the weakest data point above.

RULES:
- Max 150 words total
- Short sentences. No filler.
- Every bullet ≤ 20 words
- Use numbers, not adjectives`;


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
