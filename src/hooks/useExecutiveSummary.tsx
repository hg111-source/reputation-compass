import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

const QUERY_KEY = ['executive-summary'];

function formatThemesSection(label: string, data: PortfolioThemesResult): string {
  const pos = data.positiveThemes.slice(0, 5).map(t => `  - "${t.theme}" (${t.totalMentions} mentions, ${t.propertyCount} properties)`).join('\n');
  const neg = data.negativeThemes.slice(0, 5).map(t => `  - "${t.theme}" (${t.totalMentions} mentions, ${t.propertyCount} properties)`).join('\n');
  return `${label} Guest Themes (${data.totalAnalyzed}/${data.totalProperties} properties analyzed):\n  Strengths:\n${pos}\n  Pain Points:\n${neg}`;
}

function buildPrompt(
  kasaThemes: PortfolioThemesResult | null | undefined,
  compThemes: PortfolioThemesResult | null | undefined,
  portfolioMetrics: PortfolioMetrics | null,
  otaBenchmarks: OTABenchmark[],
  topPerformers: PropertyHighlight[],
  needsAttention: PropertyHighlight[],
): string {
  const sections: string[] = [];

  if (portfolioMetrics && portfolioMetrics.avgScore !== null) {
    sections.push(`PORTFOLIO OVERVIEW:
- ${portfolioMetrics.totalProperties} Kasa properties, average score: ${portfolioMetrics.avgScore.toFixed(2)}/10
- ${portfolioMetrics.veryGoodPlusPercent}% rated "Very Good" (8.0) or higher
- ${portfolioMetrics.exceptionalCount} properties scoring 9.5+ ("Exceptional")
- ${portfolioMetrics.belowGoodCount} properties below 7.0 needing attention
- ${portfolioMetrics.totalReviews.toLocaleString()} total guest reviews`);
  }

  if (otaBenchmarks.length > 0) {
    const otaLines = otaBenchmarks
      .filter(b => b.percentile !== null)
      .map(b => `  - ${b.platform}: ${b.kasaScore.toFixed(2)}/10 (Top ${Math.max(1, Math.round(100 - b.percentile!))}%)`)
      .join('\n');
    if (otaLines) {
      sections.push(`OTA CHANNEL BENCHMARKS (vs. competitor properties):\n${otaLines}`);
    }
  }

  if (topPerformers.length > 0) {
    const lines = topPerformers.slice(0, 5).map(p => `  - ${p.name} (${p.city}, ${p.state}): ${p.score.toFixed(2)}/10`).join('\n');
    sections.push(`TOP PERFORMERS (9.5+):\n${lines}`);
  }
  if (needsAttention.length > 0) {
    const lines = needsAttention.slice(0, 5).map(p => `  - ${p.name} (${p.city}, ${p.state}): ${p.score.toFixed(2)}/10`).join('\n');
    sections.push(`NEEDS ATTENTION (<7.0):\n${lines}`);
  }

  if (kasaThemes) sections.push(formatThemesSection('Kasa', kasaThemes));
  if (compThemes) sections.push(formatThemesSection('Competitor', compThemes));

  return `You are a hospitality industry strategist. Write a scannable executive briefing.

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
}

export function useExecutiveSummary(
  kasaThemes: PortfolioThemesResult | null | undefined,
  compThemes: PortfolioThemesResult | null | undefined,
  portfolioMetrics: PortfolioMetrics | null,
  otaBenchmarks: OTABenchmark[],
  topPerformers: PropertyHighlight[],
  needsAttention: PropertyHighlight[],
  isLoading: boolean,
) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cached = queryClient.getQueryData<string>(QUERY_KEY) ?? null;
  const canGenerate = !isLoading && (!!kasaThemes || !!compThemes || !!portfolioMetrics);

  const generate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setError(null);

    try {
      const prompt = buildPrompt(kasaThemes, compThemes, portfolioMetrics, otaBenchmarks, topPerformers, needsAttention);

      const { data, error: fnError } = await supabase.functions.invoke('analyze-executive-summary', {
        body: { prompt },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      queryClient.setQueryData(QUERY_KEY, data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setGenerating(false);
    }
  };

  return { summary: cached, generating, error, canGenerate, generate };
}
