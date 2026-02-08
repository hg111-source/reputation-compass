import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ThemeResult {
  theme: string;
  count: number;
  quote: string;
}

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

function aggregateThemes(analyses: { positive_themes: ThemeResult[]; negative_themes: ThemeResult[] }[]): PortfolioThemesResult {
  const posMap = new Map<string, { mentions: number; properties: Set<number>; topQuote: string; topCount: number }>();
  const negMap = new Map<string, { mentions: number; properties: Set<number>; topQuote: string; topCount: number }>();

  analyses.forEach((a, idx) => {
    a.positive_themes.forEach(t => {
      const existing = posMap.get(t.theme) || { mentions: 0, properties: new Set(), topQuote: '', topCount: 0 };
      existing.mentions += t.count;
      existing.properties.add(idx);
      if (t.count > existing.topCount) { existing.topQuote = t.quote; existing.topCount = t.count; }
      posMap.set(t.theme, existing);
    });
    a.negative_themes.forEach(t => {
      const existing = negMap.get(t.theme) || { mentions: 0, properties: new Set(), topQuote: '', topCount: 0 };
      existing.mentions += t.count;
      existing.properties.add(idx);
      if (t.count > existing.topCount) { existing.topQuote = t.quote; existing.topCount = t.count; }
      negMap.set(t.theme, existing);
    });
  });

  const toSorted = (map: typeof posMap): AggregatedTheme[] =>
    Array.from(map.entries())
      .map(([theme, data]) => ({
        theme,
        totalMentions: data.mentions,
        propertyCount: data.properties.size,
        topQuote: data.topQuote,
      }))
      .sort((a, b) => b.totalMentions - a.totalMentions)
      .slice(0, 8);

  return {
    positiveThemes: toSorted(posMap),
    negativeThemes: toSorted(negMap),
    totalProperties: 0,
    totalAnalyzed: analyses.length,
  };
}

export function usePortfolioThemes(propertyIds: string[], label: string) {
  return useQuery({
    queryKey: ['portfolio-themes', label, propertyIds.length],
    queryFn: async () => {
      if (propertyIds.length === 0) return null;

      // Batch in groups of 50 to avoid query limits
      const allData: { positive_themes: ThemeResult[]; negative_themes: ThemeResult[] }[] = [];
      for (let i = 0; i < propertyIds.length; i += 50) {
        const batch = propertyIds.slice(i, i + 50);
        const { data, error } = await supabase
          .from('review_analysis')
          .select('positive_themes, negative_themes')
          .in('property_id', batch);
        if (error) throw error;
        if (data) {
          data.forEach(d => {
            allData.push({
              positive_themes: (d.positive_themes as unknown as ThemeResult[]) || [],
              negative_themes: (d.negative_themes as unknown as ThemeResult[]) || [],
            });
          });
        }
      }

      if (allData.length === 0) return null;

      const result = aggregateThemes(allData);
      result.totalProperties = propertyIds.length;
      return result;
    },
    enabled: propertyIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
