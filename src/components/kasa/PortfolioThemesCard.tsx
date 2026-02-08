import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, MessageSquareQuote, Building2, Loader2 } from 'lucide-react';
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

interface PortfolioThemesCardProps {
  title: string;
  description: string;
  data: PortfolioThemesResult | null | undefined;
  isLoading: boolean;
  accentColor: 'teal' | 'blue';
}

function ThemeList({ themes, type }: { themes: AggregatedTheme[]; type: 'positive' | 'negative' }) {
  const maxMentions = themes[0]?.totalMentions || 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        {type === 'positive' ? (
          <ThumbsUp className="h-4 w-4 text-emerald-600" />
        ) : (
          <ThumbsDown className="h-4 w-4 text-red-500" />
        )}
        <h4 className="font-semibold text-sm">
          {type === 'positive' ? 'Top Strengths' : 'Common Pain Points'}
        </h4>
      </div>
      {themes.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No AI analysis data available yet.</p>
      ) : (
        themes.map((t, i) => {
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
        })
      )}
    </div>
  );
}

export function PortfolioThemesCard({ title, description, data, isLoading, accentColor }: PortfolioThemesCardProps) {
  const borderColor = accentColor === 'teal' ? 'border-l-teal-500' : 'border-l-blue-500';

  return (
    <Card className={cn('border-l-4', borderColor)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {data && (
            <Badge variant="outline" className="text-xs shrink-0">
              {data.totalAnalyzed} / {data.totalProperties} analyzed
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Aggregating themes…</span>
          </div>
        ) : !data ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No AI analysis data yet. Run insights on individual properties first.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            <ThemeList themes={data.positiveThemes} type="positive" />
            <ThemeList themes={data.negativeThemes} type="negative" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
