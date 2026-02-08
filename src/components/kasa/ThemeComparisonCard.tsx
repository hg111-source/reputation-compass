import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, ArrowLeftRight, Eye, EyeOff, Building2, MessageSquareQuote, TrendingUp, Minus } from 'lucide-react';
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

export function ThemeComparisonCard({ kasaThemes, compThemes, isLoading }: ThemeComparisonCardProps) {
  const [showAllThemes, setShowAllThemes] = useState(false);

  const consolidated = useMemo(() => {
    if (!kasaThemes || !compThemes) return null;

    return consolidateThemes(
      kasaThemes.positiveThemes,
      compThemes.positiveThemes,
      kasaThemes.negativeThemes,
      compThemes.negativeThemes
    );
  }, [kasaThemes, compThemes]);


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
              <CardTitle>Kasa vs Comp — Theme Comparison</CardTitle>
              <CardDescription>Consolidated guest sentiment themes across portfolios</CardDescription>
            </div>
          </div>
          <button
            onClick={() => setShowAllThemes(!showAllThemes)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border bg-background hover:bg-muted"
          >
            {showAllThemes ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showAllThemes ? 'Hide Raw Themes' : 'View Raw Themes'}
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs mt-2">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-teal-500" /> Kasa</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500" /> Comps</span>
        </div>
      </CardHeader>
      <CardContent>
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
