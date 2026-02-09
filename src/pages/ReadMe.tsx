import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Database, Globe, Calculator, Brain, AlertTriangle, Zap, Rocket } from 'lucide-react';

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
          <h1 className="text-4xl font-bold tracking-tight">Read Me</h1>
          <p className="mt-2 text-muted-foreground">Architecture, APIs, assumptions &amp; future improvements</p>
        </div>

        {/* 1. Architecture */}
        <Section icon={Layers} title="Architecture Overview">
          <p><strong className="text-foreground">Stack:</strong> React 18 · TypeScript · Vite · Tailwind CSS · Lovable Cloud</p>
          <MiniTable
            headers={['Layer', 'Role']}
            rows={[
              ['React SPA (Vite)', 'TanStack Query (5-min staleTime cache), React Router, Recharts'],
              ['Edge Functions (Deno)', 'External API orchestration, AI analysis (Gemini), scheduled jobs'],
              ['Postgres', 'RLS-enforced multi-tenant data, snapshot time-series, cached AI results'],
            ]}
          />
        </Section>

        {/* 2. Data Model */}
        <Section icon={Database} title="Data Model">
          <MiniTable
            headers={['Table', 'Purpose']}
            rows={[
              ['properties', 'Hotel master records (name, city, state, platform URLs, Kasa fields)'],
              ['hotel_aliases', 'Cross-platform identity resolution (property → platform ID/URL)'],
              ['source_snapshots', 'Time-series rating data per property/platform (raw + normalized 0–10)'],
              ['group_snapshots', 'Daily weighted group scores for trend tracking'],
              ['review_texts', 'Raw review text collected for AI analysis'],
              ['review_analysis', 'Cached AI theme analysis (positive/negative themes + quotes)'],
              ['executive_summaries', 'Cached AI executive briefings per user'],
              ['groups / group_properties', 'User-defined property groupings with public sharing'],
            ]}
          />
          <p><strong className="text-foreground">Multi-tenancy:</strong> All user-facing tables enforce <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">auth.uid() = user_id</code> via RLS. Groups support an <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">is_public</code> flag for read-only sharing.</p>
        </Section>

        {/* 3. External APIs */}
        <Section icon={Globe} title="External APIs">
          <MiniTable
            headers={['Platform', 'API', 'Key Details']}
            rows={[
              ['Google', 'Places API (New) — searchText', 'Stores google_place_id; supports manual ID override'],
              ['TripAdvisor', 'Apify scraper', 'Monthly quota-limited; URL-based scraping'],
              ['Booking.com', 'Apify scraper', 'Monthly quota-limited; URL-based scraping'],
              ['Expedia', 'Hotels.com API (RapidAPI)', 'Unified inventory with Hotels.com; auto-resolves missing aliases'],
              ['Kasa.com', 'Apify scraper', 'Portfolio sync of 79 properties; deduplicates on name+city+state'],
              ['Gemini AI', 'Lovable AI Gateway', 'Theme extraction, executive briefings, SWOT analysis'],
            ]}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary" className="font-normal">✅ Active: Google + Expedia (~10 s)</Badge>
            <Badge variant="outline" className="font-normal">⏸ Inactive: TripAdvisor + Booking.com text</Badge>
          </div>
        </Section>

        {/* 4. Scoring */}
        <Section icon={Calculator} title="Scoring & Normalization">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-foreground mb-2">Universal 0–10 Scale</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Google / TripAdvisor / Expedia: raw (1–5) × 2</li>
                <li>Booking.com: already 0–10</li>
                <li>Kasa internal: raw (0–5) × 2</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">Weighted Averages</p>
              <p>All composite scores use review-count weighting:</p>
              <code className="block mt-1 rounded bg-muted px-3 py-2 text-xs font-mono text-foreground">Σ(score × count) / Σ(count)</code>
            </div>
          </div>

          <MiniTable
            headers={['Tier', 'Range', 'UI Treatment']}
            rows={[
              ['Exceptional', '9.5+', 'Gold star, green badge'],
              ['Wonderful', '9.0–9.49', 'Gold star'],
              ['Very Good', '8.0–8.99', 'Blue'],
              ['Good', '7.0–7.99', 'Default'],
              ['Pleasant', '6.0–6.99', 'Yellow'],
              ['Needs Work', '<6.0', 'Red'],
            ]}
          />
        </Section>

        {/* 5. AI Features */}
        <Section icon={Brain} title="AI-Powered Features">
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-foreground">Theme Analysis</p>
              <ul className="list-disc pl-5 space-y-1 mt-1">
                <li>Filters reviews: &gt;10 words, up to 50 per sentiment bucket (≥4★ positive, ≤2★ negative)</li>
                <li>Returns top 5 themes per bucket with mention counts + verbatim quotes</li>
                <li>Cached in <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">review_analysis</code> table</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">Theme Normalization</p>
              <p>Similar themes consolidated: "Cleanliness and Hygiene" → <strong className="text-foreground">Cleanliness</strong>, "Prime Location" → <strong className="text-foreground">Location</strong>, "Friendly Staff" → <strong className="text-foreground">Staff &amp; Service</strong></p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Executive Briefing</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {['🏆 HEADLINE', '📊 PORTFOLIO', '📡 CHANNELS', '💬 GUESTS SAY', '🎯 #1 ACTION'].map(s => (
                  <Badge key={s} variant="secondary" className="font-normal text-xs">{s}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">OTA Benchmarking</p>
              <p>Kasa OTA averages calculated dynamically from weighted snapshot data. Percentiles computed using Excel PERCENTRANK behavior.</p>
            </div>
          </div>
        </Section>

        {/* 6. Assumptions */}
        <Section icon={AlertTriangle} title="Key Assumptions">
          <ol className="list-decimal pl-5 space-y-2">
            <li><strong className="text-foreground">Normalization is linear</strong> — a 4.0/5 on Google equals 8.0/10 on Booking.com. No calibration curves.</li>
            <li><strong className="text-foreground">Review-count weighting</strong> — properties with more reviews influence averages proportionally.</li>
            <li><strong className="text-foreground">Latest snapshot = current state</strong> — no decay/recency weighting on historical snapshots.</li>
            <li><strong className="text-foreground">Kasa portfolio is 79 properties</strong> — synced from Kasa.com; duplicates resolved on name+city+state.</li>
            <li><strong className="text-foreground">Comp set = all non-Kasa properties</strong> — any property without <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">kasa_url</code> is a competitor.</li>
            <li><strong className="text-foreground">AI themes are approximate</strong> — Gemini-generated themes may vary; canonical mapping mitigates inconsistency.</li>
            <li><strong className="text-foreground">Quota limits are external</strong> — RapidAPI/Apify monthly limits; affected platforms show "—".</li>
          </ol>
        </Section>

        {/* 7. Performance */}
        <Section icon={Zap} title="Performance Optimizations">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>TanStack Query 5-min staleTime across properties/snapshots</li>
            <li>Parallel review fetching (Google + Expedia simultaneously) for ~10 s analysis latency</li>
            <li>Snapshot deduplication via <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">cleanup_duplicate_snapshots</code> DB function</li>
            <li>Lazy/collapsed sections (Score Distribution collapsed by default on KasaSights)</li>
          </ul>
        </Section>

        {/* 8. Future */}
        <Section icon={Rocket} title="Future Improvements">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="font-semibold text-foreground mb-2">Short-term</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Date-range filtering on trend charts</li>
                <li>AI briefing text in CSV export</li>
                <li>Groups page CSV export</li>
                <li>Bulk property deletion</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">Medium-term</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Re-enable TripAdvisor + Booking.com text</li>
                <li>Platform-specific calibration curves</li>
                <li>Competitor auto-discovery</li>
                <li>Sentiment trends over time</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-2">Long-term</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Real-time score drop alerts</li>
                <li>Revenue correlation (ADR/RevPAR)</li>
                <li>Multi-language review analysis</li>
                <li>White-label / multi-org support</li>
              </ul>
            </div>
          </div>
        </Section>
      </div>
    </DashboardLayout>
  );
}
