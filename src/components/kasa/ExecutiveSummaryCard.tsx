import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
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

interface ExecutiveSummaryCardProps {
  kasaThemes: PortfolioThemesResult | null | undefined;
  compThemes: PortfolioThemesResult | null | undefined;
  isLoading: boolean;
}

function formatThemesForPrompt(label: string, data: PortfolioThemesResult): string {
  const pos = data.positiveThemes.map(t => `  - "${t.theme}" (${t.totalMentions} mentions across ${t.propertyCount} properties)`).join('\n');
  const neg = data.negativeThemes.map(t => `  - "${t.theme}" (${t.totalMentions} mentions across ${t.propertyCount} properties)`).join('\n');
  return `${label} (${data.totalAnalyzed} of ${data.totalProperties} properties analyzed):\n  Strengths:\n${pos}\n  Pain Points:\n${neg}`;
}

export function ExecutiveSummaryCard({ kasaThemes, compThemes, isLoading }: ExecutiveSummaryCardProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = !isLoading && (kasaThemes || compThemes);

  const generate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setError(null);

    try {
      const sections: string[] = [];
      if (kasaThemes) sections.push(formatThemesForPrompt('Kasa Portfolio', kasaThemes));
      if (compThemes) sections.push(formatThemesForPrompt('Competitor Set', compThemes));

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
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <div>
              <CardTitle>Executive "So What"</CardTitle>
              <CardDescription>AI-generated strategic takeaways from guest sentiment</CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            onClick={generate}
            disabled={!canGenerate || generating}
            className={cn(summary && '!bg-amber-100 !border-amber-300 !text-amber-900 hover:!bg-amber-200')}
            variant={summary ? 'outline' : 'default'}
          >
            {generating ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…</>
            ) : summary ? (
              <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" /> Generate</>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {!summary && !generating && !error && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Click "Generate" to create an AI-powered executive summary comparing Kasa and competitor guest sentiment.
          </p>
        )}
        {generating && !summary && (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Analyzing themes and generating insights…</span>
          </div>
        )}
        {summary && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <SummaryRenderer content={summary} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Simple markdown-like renderer (bold, bullets, paragraphs)
function SummaryRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        
        // Bold line (starts with **)
        const boldMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
        if (boldMatch) {
          return <p key={i} className="font-bold text-foreground text-base">{boldMatch[1]}</p>;
        }

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          const text = trimmed.slice(2);
          return (
            <div key={i} className="flex gap-2 text-sm">
              <span className="text-muted-foreground mt-0.5">•</span>
              <span dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          );
        }

        // Regular paragraph
        return (
          <p key={i} className="text-sm" dangerouslySetInnerHTML={{ __html: trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
        );
      })}
    </div>
  );
}
