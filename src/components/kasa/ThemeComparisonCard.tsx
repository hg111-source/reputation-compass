import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, ArrowLeftRight, Eye, EyeOff, Building2, MessageSquareQuote, TrendingUp, Minus, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface ThemeComparisonCardProps {
  kasaThemes: PortfolioThemesResult | null | undefined;
  compThemes: PortfolioThemesResult | null | undefined;
  isLoading: boolean;
}

// ── Theme consolidation ──
// Maps verbose AI-generated theme names to canonical short labels
const CANONICAL_MAP: Record<string, string> = {
  'cleanliness': 'Cleanliness',
  'clean': 'Cleanliness',
  'hygiene': 'Cleanliness',
  'maintenance': 'Cleanliness',
  'location': 'Location',
  'walkability': 'Location',
  'walkable': 'Location',
  'prime location': 'Location',
  'convenient location': 'Location',
  'central location': 'Location',
  'staff': 'Staff & Service',
  'service': 'Staff & Service',
  'helpful staff': 'Staff & Service',
  'friendly staff': 'Staff & Service',
  'front desk': 'Staff & Service',
  'customer service': 'Staff & Service',
  'hospitality': 'Staff & Service',
  'parking': 'Parking',
  'room size': 'Room Size',
  'small room': 'Room Size',
  'spacious': 'Room Size',
  'noise': 'Noise',
  'noisy': 'Noise',
  'sound': 'Noise',
  'soundproofing': 'Noise',
  'thin walls': 'Noise',
  'check-in': 'Check-in',
  'checkin': 'Check-in',
  'check in': 'Check-in',
  'self check': 'Check-in',
  'amenities': 'Amenities',
  'facilities': 'Amenities',
  'pool': 'Amenities',
  'gym': 'Amenities',
  'fitness': 'Amenities',
  'breakfast': 'Breakfast',
  'value': 'Value',
  'price': 'Value',
  'worth': 'Value',
  'overpriced': 'Value',
  'expensive': 'Value',
  'affordable': 'Value',
  'communication': 'Communication',
  'responsive': 'Communication',
  'contact': 'Communication',
  'bed': 'Bed & Comfort',
  'comfortable': 'Bed & Comfort',
  'comfort': 'Bed & Comfort',
  'mattress': 'Bed & Comfort',
  'decor': 'Design & Decor',
  'design': 'Design & Decor',
  'modern': 'Design & Decor',
  'aesthetic': 'Design & Decor',
  'stylish': 'Design & Decor',
  'view': 'Views',
  'views': 'Views',
  'scenic': 'Views',
  'kitchen': 'Kitchen',
  'cooking': 'Kitchen',
  'appliances': 'Kitchen',
  'bathroom': 'Bathroom',
  'shower': 'Bathroom',
  'wifi': 'WiFi',
  'internet': 'WiFi',
  'connectivity': 'WiFi',
  'temperature': 'HVAC',
  'hvac': 'HVAC',
  'heating': 'HVAC',
  'air conditioning': 'HVAC',
  'ac': 'HVAC',
};

function resolveCanonical(theme: string): string {
  const lower = theme.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim();

  // Direct key match
  if (CANONICAL_MAP[lower]) return CANONICAL_MAP[lower];

  // Check if any canonical keyword appears in the theme
  for (const [keyword, canonical] of Object.entries(CANONICAL_MAP)) {
    if (lower.includes(keyword) || keyword.includes(lower)) {
      return canonical;
    }
  }

  // Fallback: title-case the original
  return theme.replace(/\b\w/g, c => c.toUpperCase());
}

interface ConsolidatedTheme {
  canonical: string;
  kasaMentions: number;
  compMentions: number;
  kasaProperties: number;
  compProperties: number;
  topQuote: string;
}

function consolidateThemes(
  kasaPositive: AggregatedTheme[],
  compPositive: AggregatedTheme[],
  kasaNegative: AggregatedTheme[],
  compNegative: AggregatedTheme[]
): { strengths: ConsolidatedTheme[]; painPoints: ConsolidatedTheme[] } {
  function merge(kasaList: AggregatedTheme[], compList: AggregatedTheme[]): ConsolidatedTheme[] {
    const map = new Map<string, ConsolidatedTheme>();

    for (const t of kasaList) {
      const key = resolveCanonical(t.theme);
      const existing = map.get(key) || { canonical: key, kasaMentions: 0, compMentions: 0, kasaProperties: 0, compProperties: 0, topQuote: '' };
      existing.kasaMentions += t.totalMentions;
      existing.kasaProperties = Math.max(existing.kasaProperties, t.propertyCount);
      if (!existing.topQuote && t.topQuote) existing.topQuote = t.topQuote;
      map.set(key, existing);
    }

    for (const t of compList) {
      const key = resolveCanonical(t.theme);
      const existing = map.get(key) || { canonical: key, kasaMentions: 0, compMentions: 0, kasaProperties: 0, compProperties: 0, topQuote: '' };
      existing.compMentions += t.totalMentions;
      existing.compProperties = Math.max(existing.compProperties, t.propertyCount);
      if (!existing.topQuote && t.topQuote) existing.topQuote = t.topQuote;
      map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) => (b.kasaMentions + b.compMentions) - (a.kasaMentions + a.compMentions));
  }

  return {
    strengths: merge(kasaPositive, compPositive),
    painPoints: merge(kasaNegative, compNegative),
  };
}

function LeaderBadge({ kasaVal, compVal }: { kasaVal: number; compVal: number }) {
  if (kasaVal === 0 && compVal === 0) return null;
  if (kasaVal === 0) return <Badge variant="outline" className="text-[10px] h-5 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200">Comp only</Badge>;
  if (compVal === 0) return <Badge variant="outline" className="text-[10px] h-5 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border-teal-200">Kasa only</Badge>;
  const ratio = kasaVal / compVal;
  if (ratio > 1.3) return <Badge variant="outline" className="text-[10px] h-5 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border-teal-200"><TrendingUp className="h-3 w-3 mr-0.5" />Kasa+</Badge>;
  if (ratio < 0.7) return <Badge variant="outline" className="text-[10px] h-5 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200"><TrendingUp className="h-3 w-3 mr-0.5" />Comp+</Badge>;
  return <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground"><Minus className="h-3 w-3 mr-0.5" />Even</Badge>;
}

function ComparisonTable({ themes, type }: { themes: ConsolidatedTheme[]; type: 'positive' | 'negative' }) {
  const maxVal = Math.max(...themes.flatMap(t => [t.kasaMentions, t.compMentions]), 1);
  const totalKasa = themes.reduce((sum, t) => sum + t.kasaMentions, 0) || 1;
  const totalComp = themes.reduce((sum, t) => sum + t.compMentions, 0) || 1;

  return (
    <div>
      {/* Table header */}
      <div className="grid grid-cols-[120px_1fr_120px] gap-1 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b">
        <span>Theme</span>
        <div className="flex justify-between px-1">
          <span>← Kasa</span>
          <span>Comps →</span>
        </div>
        <span className="text-right"></span>
      </div>
      {themes.map((t, i) => {
        const kasaBarPct = (t.kasaMentions / maxVal) * 100;
        const compBarPct = (t.compMentions / maxVal) * 100;
        const kasaSharePct = Math.round((t.kasaMentions / totalKasa) * 100);
        const compSharePct = Math.round((t.compMentions / totalComp) * 100);
        const kasaColor = type === 'positive' ? 'bg-teal-500' : 'bg-rose-400';
        const compColor = type === 'positive' ? 'bg-blue-500' : 'bg-orange-400';

        return (
          <div
            key={t.canonical}
            className={cn(
              'grid grid-cols-[120px_1fr_120px] gap-1 px-3 py-2 items-center',
              i % 2 === 0 ? 'bg-muted/30' : ''
            )}
          >
            <span className="text-sm font-medium truncate">{t.canonical}</span>

            {/* Diverging bar: Kasa ← | → Comps */}
            <div className="flex items-center gap-0 h-5">
              {/* Kasa side */}
              <div className="flex-1 flex justify-end items-center gap-1.5">
                <span
                  className={cn(
                    'text-[11px] tabular-nums font-semibold cursor-default',
                    t.kasaMentions >= t.compMentions ? 'text-teal-600 dark:text-teal-400' : 'text-muted-foreground'
                  )}
                  title={`${t.kasaMentions} mentions`}
                >
                  {t.kasaMentions ? `${kasaSharePct}%` : ''}
                </span>
                <div className="w-[60%] h-2.5 rounded-l-full bg-muted/50 overflow-hidden flex justify-end">
                  <div className={cn('h-full rounded-l-full', kasaColor)} style={{ width: `${kasaBarPct}%` }} />
                </div>
              </div>
              <div className="w-px h-4 bg-border shrink-0" />
              {/* Comp side */}
              <div className="flex-1 flex items-center gap-1.5">
                <div className="w-[60%] h-2.5 rounded-r-full bg-muted/50 overflow-hidden">
                  <div className={cn('h-full rounded-r-full', compColor)} style={{ width: `${compBarPct}%` }} />
                </div>
                <span
                  className={cn(
                    'text-[11px] tabular-nums font-semibold cursor-default',
                    t.compMentions > t.kasaMentions ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                  )}
                  title={`${t.compMentions} mentions`}
                >
                  {t.compMentions ? `${compSharePct}%` : ''}
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <LeaderBadge kasaVal={t.kasaMentions} compVal={t.compMentions} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FullThemeList({ themes, label, type }: { themes: AggregatedTheme[]; label: string; type: 'positive' | 'negative' }) {
  if (themes.length === 0) return null;
  const maxMentions = themes[0]?.totalMentions || 1;

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h4>
      {themes.map((t, i) => {
        const barWidth = (t.totalMentions / maxMentions) * 100;
        return (
          <div key={t.theme} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate mr-2">{t.theme}</span>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className="text-xs font-normal">
                  {t.totalMentions} mentions
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <Building2 className="h-3 w-3" />
                  {t.propertyCount}
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  type === 'positive' ? 'bg-emerald-500' : 'bg-red-400'
                )}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            {i < 3 && t.topQuote && (
              <p className="text-xs text-muted-foreground italic pl-2 border-l-2 border-muted line-clamp-2 mt-1">
                <MessageSquareQuote className="h-3 w-3 inline mr-1 -mt-0.5" />
                "{t.topQuote}"
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
// Simple markdown-like renderer
function SummaryRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const boldMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
        if (boldMatch) return <p key={i} className="font-bold text-foreground text-sm">{boldMatch[1]}</p>;
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          const text = trimmed.slice(2);
          return (
            <div key={i} className="flex gap-2 text-xs">
              <span className="text-muted-foreground mt-0.5">•</span>
              <span dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          );
        }
        return <p key={i} className="text-xs" dangerouslySetInnerHTML={{ __html: trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />;
      })}
    </div>
  );
}

export function ThemeComparisonCard({ kasaThemes, compThemes, isLoading }: ThemeComparisonCardProps) {
  const [showAllThemes, setShowAllThemes] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const consolidated = useMemo(() => {
    if (!kasaThemes || !compThemes) return null;

    return consolidateThemes(
      kasaThemes.positiveThemes,
      compThemes.positiveThemes,
      kasaThemes.negativeThemes,
      compThemes.negativeThemes
    );
  }, [kasaThemes, compThemes]);

  const canGenerate = !isLoading && (kasaThemes || compThemes);

  const generateSummary = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setSummaryError(null);

    try {
      const sections: string[] = [];
      if (kasaThemes) {
        const pos = kasaThemes.positiveThemes.map(t => `  - "${t.theme}" (${t.totalMentions} mentions across ${t.propertyCount} properties)`).join('\n');
        const neg = kasaThemes.negativeThemes.map(t => `  - "${t.theme}" (${t.totalMentions} mentions across ${t.propertyCount} properties)`).join('\n');
        sections.push(`Kasa Portfolio (${kasaThemes.totalAnalyzed} of ${kasaThemes.totalProperties} properties analyzed):\n  Strengths:\n${pos}\n  Pain Points:\n${neg}`);
      }
      if (compThemes) {
        const pos = compThemes.positiveThemes.map(t => `  - "${t.theme}" (${t.totalMentions} mentions across ${t.propertyCount} properties)`).join('\n');
        const neg = compThemes.negativeThemes.map(t => `  - "${t.theme}" (${t.totalMentions} mentions across ${t.propertyCount} properties)`).join('\n');
        sections.push(`Competitor Set (${compThemes.totalAnalyzed} of ${compThemes.totalProperties} properties analyzed):\n  Strengths:\n${pos}\n  Pain Points:\n${neg}`);
      }

      const prompt = `You are a hospitality industry strategist specializing in tech-enabled accommodation brands.

CRITICAL CONTEXT about Kasa:
- Kasa is a TECH-ENABLED hospitality company — NOT a traditional hotel chain
- Kasa properties have NO on-site front desk staff and NO traditional concierge
- Guest communication is primarily digital (app, SMS, automated messaging)
- Check-in is fully self-service (keyless entry, digital guides)
- Kasa competes with traditional hotels on quality but with a lean, scalable tech model
- Recommendations should focus on technology, digital experience, automation, and operational efficiency — NOT hiring staff or in-person service training

Given the aggregated guest review theme analysis below (Kasa = our managed properties, Comps = competitor hotels):

${sections.join('\n\n')}

Requirements:
- Start with the single most important strategic insight (1 sentence, bold)
- Then 3-4 bullet points covering: competitive advantages, vulnerabilities, and one actionable recommendation
- Use data (mention counts, property counts) to support claims
- Recommendations must be relevant to Kasa's tech-enabled model (e.g., improve automated communication, enhance digital check-in, optimize app experience)
- Do NOT suggest hiring staff, training front desk employees, or implementing traditional hotel service programs
- Keep total under 200 words
- Use markdown formatting`;

      const { data, error: fnError } = await supabase.functions.invoke('analyze-executive-summary', {
        body: { prompt },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setSummary(data.summary);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading || !consolidated) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-purple-500" />
            <div>
              <CardTitle>What Guests Talk About</CardTitle>
              <CardDescription>AI analysis of guest reviews — Kasa vs. competitors</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAllThemes(!showAllThemes)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border bg-background hover:bg-muted"
            >
              {showAllThemes ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showAllThemes ? 'Hide Raw' : 'Raw Themes'}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 bg-muted/50 rounded-md px-3 py-2">
          <strong>How to read:</strong> Each % shows how much of that portfolio's review conversation is about that theme. Longer bar = more discussed. Hover any % to see the raw mention count.
        </p>
        <div className="flex items-center gap-4 text-xs mt-2">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-teal-500" /> Kasa</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500" /> Comps</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Executive "So What" — integrated */}
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-sm">So What?</span>
              <span className="text-xs text-muted-foreground">— AI strategic takeaway from the data below</span>
            </div>
            <Button
              size="sm"
              variant={summary ? 'outline' : 'default'}
              onClick={generateSummary}
              disabled={!canGenerate || generating}
              className={cn('h-7 text-xs', summary && '!bg-amber-100 !border-amber-300 !text-amber-900 hover:!bg-amber-200')}
            >
              {generating ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Thinking…</>
              ) : summary ? (
                <><RefreshCw className="h-3 w-3" /> Regenerate</>
              ) : (
                <><Sparkles className="h-3 w-3" /> Generate</>
              )}
            </Button>
          </div>
          {summaryError && <p className="text-sm text-destructive">{summaryError}</p>}
          {!summary && !generating && !summaryError && (
            <p className="text-xs text-muted-foreground">Click "Generate" to get AI-powered strategic insights from the theme data.</p>
          )}
          {generating && !summary && (
            <div className="flex items-center gap-2 text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-xs">Analyzing themes…</span>
            </div>
          )}
          {summary && <SummaryRenderer content={summary} />}
        </div>

        {/* Theme tables */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Strengths */}
          <div>
            <div className={cn('flex items-center gap-2 pb-2 mb-3 border-b border-emerald-200 dark:border-emerald-800')}>
              <ThumbsUp className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold text-sm">Strengths</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">{consolidated.strengths.length} themes</Badge>
            </div>
            <ComparisonTable themes={consolidated.strengths} type="positive" />
          </div>

          {/* Pain Points */}
          <div>
            <div className={cn('flex items-center gap-2 pb-2 mb-3 border-b border-red-200 dark:border-red-800')}>
              <ThumbsDown className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-sm">Pain Points</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">{consolidated.painPoints.length} themes</Badge>
            </div>
            <ComparisonTable themes={consolidated.painPoints} type="negative" />
          </div>
        </div>

        {/* Expandable raw theme detail */}
        {showAllThemes && (
          <div className="mt-8 pt-6 border-t space-y-8">
            <p className="text-xs text-muted-foreground">Raw AI-generated themes before consolidation</p>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-teal-500" /> Kasa Portfolio
                  {kasaThemes && (
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      {kasaThemes.totalAnalyzed}/{kasaThemes.totalProperties} analyzed
                    </Badge>
                  )}
                </h3>
                <FullThemeList themes={kasaThemes?.positiveThemes ?? []} label="Strengths" type="positive" />
                <FullThemeList themes={kasaThemes?.negativeThemes ?? []} label="Pain Points" type="negative" />
              </div>
              <div className="space-y-6">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-blue-500" /> Comp Set
                  {compThemes && (
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      {compThemes.totalAnalyzed}/{compThemes.totalProperties} analyzed
                    </Badge>
                  )}
                </h3>
                <FullThemeList themes={compThemes?.positiveThemes ?? []} label="Strengths" type="positive" />
                <FullThemeList themes={compThemes?.negativeThemes ?? []} label="Pain Points" type="negative" />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
