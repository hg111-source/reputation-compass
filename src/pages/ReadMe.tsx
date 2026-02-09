import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Database, Globe, Calculator, Brain, AlertTriangle, Zap, Rocket, Target, Crosshair, FileText, MessageSquare, BookOpen, CheckCircle2, Lightbulb, Shield, Compass, Github, ExternalLink } from 'lucide-react';

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

function MiniTable({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Read Me</h1>
            <p className="mt-2 text-muted-foreground">AI-native reputation intelligence — context, architecture, and methodology</p>
          </div>
          <a
            href="https://github.com/hg111-source/reputation-compass"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent/10 hover:text-accent"
          >
            <Github className="h-4 w-4" />
            GitHub Source Code
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </div>

        {/* Context */}
        <Section icon={BookOpen} title="Context">
          <p>A key part of this role is ensuring Kasa is at the forefront of AI transformation. The Chief of Staff should be increasingly <strong className="text-foreground">AI-native</strong> and continuously learning to apply modern AI tooling to real operational problems.</p>
          <p>This exercise explores how a lightweight, AI-assisted reputation dashboard can aggregate and interpret online hotel review data across major platforms — while also illustrating how such a tool could evolve toward <strong className="text-foreground">production-grade decision support</strong>.</p>
        </Section>

        {/* Goal */}
        <Section icon={Compass} title="Goal">
          <p>Build a lightweight web-based dashboard that aggregates, analyzes, and visualizes online hotel review data across major OTA and review platforms.</p>
          <p className="mt-2">The system monitors hotel performance across the <strong className="text-foreground">"Big 4" channels</strong>:</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {['Google', 'TripAdvisor', 'Expedia', 'Booking.com'].map(c => (
              <Badge key={c} variant="secondary" className="font-normal">{c}</Badge>
            ))}
          </div>
          <p className="mt-3">and allows a user to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>Log in</li>
            <li>Manage lists of properties</li>
            <li>View review scores by property</li>
            <li>See a consolidated weighted review score by group</li>
          </ul>
          <Badge variant="outline" className="mt-2 font-normal">✓ Core goal implemented as a fully functional web application</Badge>
        </Section>

        {/* Core Functionality */}
        <Section icon={CheckCircle2} title="Core Functionality">
          <div className="space-y-5">
            <div>
              <p className="font-semibold text-foreground">1. Hotel Input</p>
              <p className="mt-1">Accepts user-uploaded hotel lists including name, city/location, and optional website or OTA URLs. Normalization challenges across platforms were handled through alias resolution and URL matching logic.</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="font-normal text-xs">✓ Scalable architecture</Badge>
                <Badge variant="outline" className="font-normal text-xs">→ Demo constrained to ~100 hotels (API limits)</Badge>
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">2. Review Data Collection</p>
              <p className="mt-1">For each hotel, retrieves average review score and total review count across Google, TripAdvisor, Expedia, and Booking.com. Data access combines official APIs, third-party APIs, and resilient scraping approaches chosen for durability over time.</p>
              <Badge variant="outline" className="font-normal text-xs mt-2">✓ Architecture designed for long-term reliability</Badge>
            </div>
            <div>
              <p className="font-semibold text-foreground">3. Scoring &amp; Aggregation</p>
              <p className="mt-1">All platform scores converted to a common 0–10 scale. Composite scores calculated using review-count weighting. All assumptions and transformations explicitly documented.</p>
              <div className="mt-2 rounded-lg bg-muted/30 border border-border/40 p-3 text-xs">
                <p className="font-medium text-foreground mb-1">Extension Opportunity</p>
                <p>Architecture allows future room-weighted or revenue-aware scoring, enabling prioritization based on economic impact, not sentiment alone. Kasa operates assets, so reputation insight is most valuable when aligned to portfolio value.</p>
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">4. Grouping &amp; Persistence</p>
              <p className="mt-1">Supports saving hotels into named groups, re-running collection for updated snapshots, clean table/card visualizations, and basic historical trend visibility.</p>
              <div className="mt-2 rounded-lg bg-muted/30 border border-border/40 p-3 text-xs">
                <p className="font-medium text-foreground mb-1">Extension Opportunity</p>
                <p>Snapshot architecture enables score-drop alerts, trend diagnostics, and correlation with operational or revenue metrics. Reputation is most useful dynamically, not statically.</p>
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">5. Data Export</p>
              <p className="mt-1">Users can export raw review data and aggregated results in CSV/Excel-compatible format.</p>
              <Badge variant="outline" className="font-normal text-xs mt-2">✓ Implemented per prompt</Badge>
            </div>
            <div>
              <p className="font-semibold text-foreground">6. Authentication / Access</p>
              <p className="mt-1">Email login with shared-read data model. All authenticated users can <strong className="text-foreground">view</strong> all properties, snapshots, and analysis data. Write operations (create, edit, delete) remain restricted to the data owner.</p>
              <Badge variant="outline" className="font-normal text-xs mt-2">✓ Shared-read, owner-write model</Badge>
            </div>
          </div>
        </Section>

        {/* Stretch Enhancements */}
        <Section icon={Lightbulb} title="Stretch Enhancements">
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-foreground">Level 1 — AI Review Theme Analysis</p>
              <p className="mt-1">Summarizes key positive and negative themes at hotel and portfolio level via LLM-powered analysis with caching.</p>
              <Badge variant="outline" className="font-normal text-xs mt-2">✓ Implemented as modular AI layer</Badge>
              <p className="mt-1.5 text-xs italic">Moves the tool from reporting → decision support, which is where AI delivers the most operational value.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Level 2 — Time-Range Filtering</p>
              <p className="mt-1">Acknowledged as complex due to review-level timestamp requirements. Architecture prepared via snapshot time-series design.</p>
              <Badge variant="outline" className="font-normal text-xs mt-2">→ Not fully implemented</Badge>
            </div>
            <div>
              <p className="font-semibold text-foreground">Level 3 — Airbnb Integration</p>
              <p className="mt-1">Recognized as non-trivial due to incomplete coverage and entity-matching complexity. Architecture structured to support additional channels without redesign.</p>
              <Badge variant="outline" className="font-normal text-xs mt-2">→ Treated as future extension</Badge>
            </div>
          </div>
        </Section>

        {/* Design Philosophy */}
        <Section icon={Shield} title="Design Philosophy">
          <p>This implementation prioritizes:</p>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li><strong className="text-foreground">Strict alignment</strong> with the original prompt</li>
            <li>A <strong className="text-foreground">fully working</strong> lightweight system</li>
            <li><strong className="text-foreground">Modular extensions</strong> demonstrating how AI could evolve the tool into a scalable, AI-native reputation intelligence layer supporting faster portfolio-level decision making at Kasa</li>
          </ul>
          <div className="mt-3 rounded-lg bg-muted/30 border border-border/40 p-3 text-xs">
            <p className="font-medium text-foreground mb-1">Final Framing</p>
            <p>The core delivers everything the prompt asked for — a working, end-to-end reputation dashboard. The extensions beyond that aren't scope creep; they're a glimpse at where this tool naturally wants to go. Each one was built to plug in cleanly and show how AI-native tooling can move from "nice report" to <strong className="text-foreground">"here's what to do about it"</strong> — which is ultimately what makes a tool like this worth building for a company like Kasa.</p>
          </div>
        </Section>

        <div className="border-t-2 border-border pt-6 mt-2" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Architecture &amp; Methodology</h2>
          <p className="mt-1 text-muted-foreground text-sm">Technical design, data model, and scoring framework</p>
        </div>

        {/* Purpose */}
        <Section icon={Target} title="Purpose">
          <p>This dashboard aggregates and analyzes guest reputation across Kasa's portfolio and major OTA channels to provide <strong className="text-foreground">real-time performance visibility</strong> and <strong className="text-foreground">AI-driven executive insights</strong> for leadership and operators.</p>
        </Section>

        {/* Scope */}
        <Section icon={Crosshair} title="Scope">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Normalizes ratings across major review platforms to a universal 0–10 scale</li>
            <li>Computes review-weighted portfolio and group benchmarks</li>
            <li>Extracts AI-generated sentiment themes and executive summaries</li>
            <li>Enables trend monitoring and rapid performance diagnosis</li>
          </ul>
          <div className="mt-3 rounded-lg bg-muted/30 border border-border/40 p-3 text-xs">
            <p className="font-medium text-foreground mb-1">Bonus: Kasa Portfolio Integration</p>
            <p>As a stretch extension, <strong className="text-foreground">79 Kasa properties</strong> were synchronized from Kasa.com to power the <strong className="text-foreground">KasaSights</strong> page — a dedicated executive layer providing portfolio-wide SWOT analysis, OTA benchmarking, geographic mapping, and AI-generated strategic briefings. This transforms the tool from a competitive tracker into a "so what" decision engine for Kasa leadership.</p>
          </div>
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
          <p><strong className="text-foreground">Access model:</strong> All authenticated users can <strong className="text-foreground">read</strong> all data. Write operations (insert, update, delete) are restricted to the owner via <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">auth.uid() = user_id</code> RLS policies. Groups support read-only sharing through an <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">is_public</code> flag.</p>
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
          <p className="mb-3">Prioritized by <strong className="text-foreground">impact</strong> (operational value to Kasa) vs. <strong className="text-foreground">effort</strong> (engineering complexity).</p>
          <MiniTable
            headers={['Priority', 'Improvement', 'Impact', 'Effort']}
            rows={[
              ['🟢 P0', <strong className="text-foreground">Date-range trend filtering</strong>, <strong className="text-foreground">High</strong>, 'Low'],
              ['🟢 P0', <strong className="text-foreground">Bulk property deletion</strong>, <strong className="text-foreground">High</strong>, 'Low'],
              ['🟢 P0', <strong className="text-foreground">AI briefing text in CSV export</strong>, <strong className="text-foreground">High</strong>, 'Low'],
              ['🟢 P0', <strong className="text-foreground">Group-level CSV export</strong>, 'Medium', 'Low'],
              ['🟢 P0', <strong className="text-foreground">Role-based permissions & edit controls</strong>, <strong className="text-foreground">High</strong>, 'Medium'],
              ['🟡 P1', <strong className="text-foreground">Room-weighted portfolio scoring</strong>, <strong className="text-foreground">High</strong>, 'Medium'],
              ['🟡 P1', <strong className="text-foreground">Re-enable TripAdvisor & Booking.com review text</strong>, <strong className="text-foreground">High</strong>, 'Medium'],
              ['🟡 P1', <strong className="text-foreground">Sentiment trends over time</strong>, <strong className="text-foreground">High</strong>, 'Medium'],
              ['🟡 P1', <strong className="text-foreground">Real-time score-drop alerts</strong>, <strong className="text-foreground">High</strong>, 'Medium'],
              ['🟡 P1', 'Automated competitor discovery', 'Medium', 'Medium'],
              ['🔵 P2', <strong className="text-foreground">Revenue correlation (ADR / RevPAR)</strong>, <strong className="text-foreground">High</strong>, 'High'],
              ['🔵 P2', <strong className="text-foreground">Property Owner Insight Layer</strong>, <strong className="text-foreground">High</strong>, 'High'],
              ['🔵 P2', <strong className="text-foreground">Revenue-aware reputation analytics</strong>, <strong className="text-foreground">High</strong>, 'High'],
              ['🔵 P2', 'Platform-specific calibration curves', 'Medium', 'Medium'],
              ['⚪ P3', 'Multi-language sentiment analysis', 'Medium', 'High'],
              ['⚪ P3', 'White-label multi-org support', 'Low', 'High'],
            ]}
          />
          <div className="flex flex-wrap gap-3 mt-3 text-xs">
            <span><span className="font-semibold">🟢 P0</span> Quick wins</span>
            <span><span className="font-semibold">🟡 P1</span> High-value, moderate build</span>
            <span><span className="font-semibold">🔵 P2</span> Strategic, requires data/infra</span>
            <span><span className="font-semibold">⚪ P3</span> Long-term vision</span>
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
