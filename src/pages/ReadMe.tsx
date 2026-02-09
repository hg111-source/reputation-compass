import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Database, Globe, Calculator, Brain, AlertTriangle, Zap, Rocket, Target, Crosshair, FileText, MessageSquare } from 'lucide-react';

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent">
            <Icon className="h-5 w-5" />
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}

function MiniTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-left font-semibold text-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border/30">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReadMe() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">System Architecture &amp; Methodology</h1>
          <p className="mt-2 text-muted-foreground">Reputation intelligence platform — design, data, and decision framework</p>
        </div>

        {/* Purpose */}
        <Section icon={Target} title="Purpose">
          <p>This dashboard aggregates and analyzes guest reputation across Kasa's portfolio and major OTA channels to provide <strong className="text-foreground">real-time performance visibility</strong> and <strong className="text-foreground">AI-driven executive insights</strong> for leadership and operators.</p>
        </Section>

        {/* Scope */}
        <Section icon={Crosshair} title="Scope">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Covers <strong className="text-foreground">79 Kasa properties</strong> synchronized from Kasa.com</li>
            <li>Normalizes ratings across major review platforms to a universal 0–10 scale</li>
            <li>Computes review-weighted portfolio and group benchmarks</li>
            <li>Extracts AI-generated sentiment themes and executive summaries</li>
            <li>Enables trend monitoring and rapid performance diagnosis</li>
          </ul>
        </Section>

        {/* Outcome */}
        <Section icon={FileText} title="Outcome">
          <p>Enables leadership to quickly identify:</p>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li>Portfolio-level strengths and risks</li>
            <li>Channel-specific performance gaps</li>
            <li>Property-level priorities for action</li>
            <li>Emerging guest sentiment themes</li>
            <li>Operational focus areas with the greatest portfolio impact</li>
          </ul>
        </Section>

        {/* Architecture */}
        <Section icon={Layers} title="Architecture Overview">
          <p><strong className="text-foreground">Stack:</strong> React 18 · TypeScript · Vite · Tailwind CSS · Lovable Cloud</p>
          <MiniTable
            headers={['Layer', 'Role']}
            rows={[
              ['React SPA (Vite)', 'TanStack Query (5-min cache), React Router, Recharts'],
              ['Edge Functions (Deno)', 'External API orchestration, AI analysis (Gemini), scheduled jobs'],
              ['Postgres', 'RLS-enforced multi-tenant data, time-series snapshots, cached AI outputs'],
            ]}
          />
        </Section>

        {/* Data Model */}
        <Section icon={Database} title="Data Model">
          <MiniTable
            headers={['Table', 'Purpose']}
            rows={[
              ['properties', 'Hotel master records (name, city, state, platform URLs, Kasa fields)'],
              ['hotel_aliases', 'Cross-platform identity resolution'],
              ['source_snapshots', 'Time-series rating data per property/platform (normalized 0–10)'],
              ['group_snapshots', 'Daily weighted group scores for trend tracking'],
              ['review_texts', 'Raw review text for AI analysis'],
              ['review_analysis', 'Cached sentiment themes and quotes'],
              ['executive_summaries', 'Cached AI executive briefings per user'],
              ['groups / group_properties', 'User-defined groupings with optional public sharing'],
            ]}
          />
          <p><strong className="text-foreground">Multi-tenancy:</strong> All user tables enforce <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">auth.uid() = user_id</code> via Row Level Security. Groups support read-only sharing through an <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">is_public</code> flag.</p>
        </Section>

        {/* External Data Sources */}
        <Section icon={Globe} title="External Data Sources">
          <MiniTable
            headers={['Platform', 'Source', 'Notes']}
            rows={[
              ['Google', 'Places API (New)', 'Supports manual place ID override'],
              ['TripAdvisor', 'Apify scraper', 'Monthly quota-limited'],
              ['Booking.com', 'Apify scraper', 'Monthly quota-limited'],
              ['Expedia', 'Hotels.com API (RapidAPI)', 'Unified inventory resolution'],
              ['Kasa.com', 'Apify scraper', 'Syncs 79-property portfolio; deduplicated'],
              ['Gemini AI', 'Lovable AI Gateway', 'Themes, summaries, SWOT insights'],
            ]}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary" className="font-normal">✅ Active: Google + Expedia (~10s latency)</Badge>
            <Badge variant="outline" className="font-normal">⏸ Inactive: TripAdvisor + Booking.com review text</Badge>
          </div>
        </Section>

        {/* Scoring */}
        <Section icon={Calculator} title="Scoring & Normalization">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-foreground mb-2">Universal 0–10 Scale</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Google / TripAdvisor / Expedia: (1–5) × 2</li>
                <li>Booking.com: native 0–10</li>
                <li>Kasa internal: (0–5) × 2</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">Weighted Composite Scores</p>
              <p>All blended scores use review-count weighting:</p>
              <code className="block mt-1 rounded bg-muted px-3 py-2 text-xs font-mono text-foreground">Σ(score × review_count) / Σ(review_count)</code>
              <p className="mt-1.5 text-xs italic">This emphasizes statistical confidence in guest sentiment.</p>
            </div>
          </div>

          <MiniTable
            headers={['Tier', 'Range', 'UI Treatment']}
            rows={[
              ['Exceptional', '9.5+', 'Gold star · Green badge'],
              ['Wonderful', '9.0–9.49', 'Gold star'],
              ['Very Good', '8.0–8.99', 'Blue'],
              ['Good', '7.0–7.99', 'Neutral'],
              ['Pleasant', '6.0–6.99', 'Yellow'],
              ['Needs Work', '<6.0', 'Red'],
            ]}
          />
        </Section>

        {/* AI Features */}
        <Section icon={Brain} title="AI-Powered Analysis">
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-foreground">Theme Extraction</p>
              <ul className="list-disc pl-5 space-y-1 mt-1">
                <li>Reviews filtered to &gt;10 words, max 50 per sentiment bucket</li>
                <li>Positive ≥4★ · Negative ≤2★</li>
                <li>Returns top themes, counts, and verbatim quotes</li>
                <li>Cached for performance</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">Theme Normalization</p>
              <p>Conceptually similar themes consolidated (e.g., <em>Cleanliness &amp; Hygiene</em> → <strong className="text-foreground">Cleanliness</strong>, <em>Prime Location</em> → <strong className="text-foreground">Location</strong>, <em>Friendly Staff</em> → <strong className="text-foreground">Staff &amp; Service</strong>).</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Executive Briefing Structure</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {['🏆 Headline Signal', '📊 Portfolio Trend', '📡 Channel Insights', '💬 Guest Themes', '🎯 Top Action'].map(s => (
                  <Badge key={s} variant="secondary" className="font-normal text-xs">{s}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">OTA Benchmarking</p>
              <ul className="list-disc pl-5 space-y-1 mt-1">
                <li>Portfolio OTA averages computed from weighted snapshot data</li>
                <li>Percentiles follow Excel PERCENTRANK methodology</li>
              </ul>
              <div className="mt-2 rounded-lg bg-muted/30 border border-border/40 p-3 text-xs">
                <p className="font-medium text-foreground mb-1">Note on OTA vs. Brand Score Variance</p>
                <p>Differences between OTA averages and displayed brand ratings may reflect additional channels (e.g., Airbnb, direct surveys), recency weighting, or platform normalization. These indicate methodology variation, not performance error.</p>
              </div>
            </div>
          </div>
        </Section>

        {/* Assumptions */}
        <Section icon={AlertTriangle} title="Key Assumptions">
          <ol className="list-decimal pl-5 space-y-2">
            <li><strong className="text-foreground">Linear normalization</strong> across review scales</li>
            <li><strong className="text-foreground">Review-count weighting</strong> reflects statistical confidence</li>
            <li><strong className="text-foreground">Latest snapshot</strong> represents current state (no recency decay)</li>
            <li><strong className="text-foreground">Portfolio size</strong> fixed at 79 synced Kasa properties</li>
            <li><strong className="text-foreground">Competitors</strong> defined as non-Kasa properties</li>
            <li><strong className="text-foreground">AI-generated themes</strong> are directional; normalization reduces variance</li>
            <li><strong className="text-foreground">External API quotas</strong> may temporarily limit coverage</li>
          </ol>
        </Section>

        {/* Performance */}
        <Section icon={Zap} title="Performance Optimizations">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>5-minute TanStack Query caching</li>
            <li>Parallel review fetching (~10s latency)</li>
            <li>Snapshot deduplication via database function</li>
            <li>Lazy-loaded / collapsed analytical sections</li>
          </ul>
        </Section>

        {/* Future */}
        <Section icon={Rocket} title="Future Improvements">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="font-semibold text-foreground mb-2">Short-Term</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Date-range trend filtering</li>
                <li>AI briefing text in CSV export</li>
                <li>Group-level CSV export</li>
                <li>Bulk property deletion</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">Medium-Term</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Re-enable TripAdvisor &amp; Booking.com review text</li>
                <li>Platform-specific calibration curves</li>
                <li>Automated competitor discovery</li>
                <li>Sentiment trends over time</li>
                <li>Room-weighted portfolio scoring to reflect operational scale and revenue exposure</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">Long-Term</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Real-time score-drop alerts</li>
                <li>Revenue correlation (ADR / RevPAR)</li>
                <li>Multi-language sentiment analysis</li>
                <li>White-label multi-org support</li>
                <li>Property Owner Insight Layer with asset-level briefings and competitive context</li>
                <li>Revenue-aware reputation analytics combining sentiment, unit scale, and financial metrics</li>
              </ul>
            </div>
          </div>
        </Section>

        {/* Final Note */}
        <Section icon={MessageSquare} title="Final Note">
          <p className="italic">
            This system is designed as a <strong className="text-foreground">lightweight, AI-native reputation intelligence layer</strong> — enabling faster decisions, clearer portfolio visibility, and scalable insight delivery across Kasa's operating platform.
          </p>
        </Section>
      </div>
    </DashboardLayout>
  );
}
