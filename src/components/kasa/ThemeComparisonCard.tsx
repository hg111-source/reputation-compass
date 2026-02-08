import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, ArrowLeftRight, Eye, EyeOff, Building2, MessageSquareQuote } from 'lucide-react';
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

// Normalize theme names for fuzzy matching
function normalizeTheme(theme: string): string {
  return theme.toLowerCase().replace(/[^a-z ]/g, '').trim();
}

function findOverlap(
  kasaList: AggregatedTheme[],
  compList: AggregatedTheme[]
): { shared: { theme: string; kasaMentions: number; compMentions: number }[]; kasaOnly: AggregatedTheme[]; compOnly: AggregatedTheme[] } {
  const shared: { theme: string; kasaMentions: number; compMentions: number }[] = [];
  const matchedKasa = new Set<number>();
  const matchedComp = new Set<number>();

  // Simple keyword overlap matching
  kasaList.forEach((kt, ki) => {
    const kNorm = normalizeTheme(kt.theme);
    const kWords = new Set(kNorm.split(' ').filter(w => w.length > 3));

    compList.forEach((ct, ci) => {
      if (matchedComp.has(ci)) return;
      const cNorm = normalizeTheme(ct.theme);
      const cWords = cNorm.split(' ').filter(w => w.length > 3);
      const overlap = cWords.filter(w => kWords.has(w)).length;
      if (overlap >= 1 || kNorm.includes(cNorm) || cNorm.includes(kNorm)) {
        shared.push({ theme: kt.theme, kasaMentions: kt.totalMentions, compMentions: ct.totalMentions });
        matchedKasa.add(ki);
        matchedComp.add(ci);
      }
    });
  });

  const kasaOnly = kasaList.filter((_, i) => !matchedKasa.has(i));
  const compOnly = compList.filter((_, i) => !matchedComp.has(i));

  return { shared, kasaOnly, compOnly };
}

function SectionHeader({ icon, label, type }: { icon: React.ReactNode; label: string; type: 'positive' | 'negative' }) {
  return (
    <div className={cn(
      'flex items-center gap-2 pb-2 mb-3 border-b',
      type === 'positive' ? 'border-emerald-200 dark:border-emerald-800' : 'border-red-200 dark:border-red-800'
    )}>
      {icon}
      <span className="font-semibold text-sm">{label}</span>
    </div>
  );
}

function ThemeRow({ theme, kasaVal, compVal, maxVal, color }: { theme: string; kasaVal: number; compVal: number; maxVal: number; color: string }) {
  return (
    <div className="space-y-1 py-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium truncate mr-2">{theme}</span>
      </div>
      <div className="flex items-center gap-2 h-4">
        {/* Kasa bar (right-aligned, grows left) */}
        <div className="flex-1 flex justify-end">
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden flex justify-end">
            <div
              className={cn('h-full rounded-full', color === 'green' ? 'bg-teal-500' : 'bg-rose-400')}
              style={{ width: `${(kasaVal / maxVal) * 100}%` }}
            />
          </div>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground w-8 text-center shrink-0">
          {kasaVal}|{compVal}
        </span>
        {/* Comp bar (left-aligned, grows right) */}
        <div className="flex-1">
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full', color === 'green' ? 'bg-blue-500' : 'bg-orange-400')}
              style={{ width: `${(compVal / maxVal) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function UniqueThemeList({ themes, label, color }: { themes: AggregatedTheme[]; label: string; color: string }) {
  if (themes.length === 0) return null;
  return (
    <div className="space-y-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      {themes.slice(0, 4).map(t => (
        <div key={t.theme} className="flex items-center justify-between text-xs py-0.5">
          <span className="truncate mr-2">{t.theme}</span>
          <Badge variant="secondary" className={cn('text-[10px] h-4 px-1.5', color)}>
            {t.totalMentions}
          </Badge>
        </div>
      ))}
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

  const comparison = useMemo(() => {
    if (!kasaThemes || !compThemes) return null;

    const positive = findOverlap(kasaThemes.positiveThemes, compThemes.positiveThemes);
    const negative = findOverlap(kasaThemes.negativeThemes, compThemes.negativeThemes);

    const allMentions = [
      ...positive.shared.flatMap(s => [s.kasaMentions, s.compMentions]),
      ...positive.kasaOnly.map(t => t.totalMentions),
      ...positive.compOnly.map(t => t.totalMentions),
      ...negative.shared.flatMap(s => [s.kasaMentions, s.compMentions]),
      ...negative.kasaOnly.map(t => t.totalMentions),
      ...negative.compOnly.map(t => t.totalMentions),
    ];
    const maxVal = Math.max(...allMentions, 1);

    return { positive, negative, maxVal };
  }, [kasaThemes, compThemes]);

  if (isLoading || !comparison) {
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
              <CardDescription>Shared and unique guest sentiment themes</CardDescription>
            </div>
          </div>
          <button
            onClick={() => setShowAllThemes(!showAllThemes)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border bg-background hover:bg-muted"
          >
            {showAllThemes ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showAllThemes ? 'Hide Full Detail' : 'View All Themes'}
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs mt-2">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-teal-500" /> Kasa</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500" /> Comps</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Positive Themes */}
          <div>
            <SectionHeader
              icon={<ThumbsUp className="h-4 w-4 text-emerald-600" />}
              label="Strengths"
              type="positive"
            />
            {comparison.positive.shared.length > 0 && (
              <div className="mb-4">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Shared Strengths</span>
                {comparison.positive.shared.map(s => (
                  <ThemeRow
                    key={s.theme}
                    theme={s.theme}
                    kasaVal={s.kasaMentions}
                    compVal={s.compMentions}
                    maxVal={comparison.maxVal}
                    color="green"
                  />
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <UniqueThemeList themes={comparison.positive.kasaOnly} label="Kasa Only" color="text-teal-700 dark:text-teal-300" />
              <UniqueThemeList themes={comparison.positive.compOnly} label="Comp Only" color="text-blue-700 dark:text-blue-300" />
            </div>
          </div>

          {/* Negative Themes */}
          <div>
            <SectionHeader
              icon={<ThumbsDown className="h-4 w-4 text-red-500" />}
              label="Pain Points"
              type="negative"
            />
            {comparison.negative.shared.length > 0 && (
              <div className="mb-4">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Shared Issues</span>
                {comparison.negative.shared.map(s => (
                  <ThemeRow
                    key={s.theme}
                    theme={s.theme}
                    kasaVal={s.kasaMentions}
                    compVal={s.compMentions}
                    maxVal={comparison.maxVal}
                    color="red"
                  />
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <UniqueThemeList themes={comparison.negative.kasaOnly} label="Kasa Only" color="text-rose-700 dark:text-rose-300" />
              <UniqueThemeList themes={comparison.negative.compOnly} label="Comp Only" color="text-orange-700 dark:text-orange-300" />
            </div>
          </div>
        </div>

        {/* Expandable full theme detail */}
        {showAllThemes && (
          <div className="mt-8 pt-6 border-t space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-teal-500" /> Kasa Portfolio — All Themes
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
                  <span className="w-3 h-3 rounded bg-blue-500" /> Comp Set — All Themes
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