import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

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

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Read Me</h1>
          <p className="mt-2 text-muted-foreground">
            Architecture, APIs, assumptions & future improvements
          </p>
        </div>

        <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-td:text-muted-foreground prose-th:text-foreground">

          <h2>1. Architecture Overview</h2>
          <p><strong>Stack:</strong> React 18 + TypeScript + Vite + Tailwind CSS + Lovable Cloud</p>
          <table>
            <thead><tr><th>Layer</th><th>Role</th></tr></thead>
            <tbody>
              <tr><td>React SPA (Vite)</td><td>TanStack Query (5-min staleTime cache), React Router, Recharts</td></tr>
              <tr><td>Edge Functions (Deno)</td><td>External API orchestration, AI analysis (Gemini), scheduled jobs</td></tr>
              <tr><td>Postgres</td><td>RLS-enforced multi-tenant data, snapshot time-series, cached AI results</td></tr>
            </tbody>
          </table>

          <h2>2. Data Model</h2>
          <table>
            <thead><tr><th>Table</th><th>Purpose</th></tr></thead>
            <tbody>
              <tr><td><code>properties</code></td><td>Hotel master records (name, city, state, platform URLs, Kasa fields)</td></tr>
              <tr><td><code>hotel_aliases</code></td><td>Cross-platform identity resolution (property → platform ID/URL)</td></tr>
              <tr><td><code>source_snapshots</code></td><td>Time-series rating data per property/platform (raw + normalized 0–10)</td></tr>
              <tr><td><code>group_snapshots</code></td><td>Daily weighted group scores for trend tracking</td></tr>
              <tr><td><code>review_texts</code></td><td>Raw review text collected for AI analysis</td></tr>
              <tr><td><code>review_analysis</code></td><td>Cached AI theme analysis (positive/negative themes + quotes)</td></tr>
              <tr><td><code>executive_summaries</code></td><td>Cached AI executive briefings per user</td></tr>
              <tr><td><code>groups</code> / <code>group_properties</code></td><td>User-defined property groupings with public sharing</td></tr>
            </tbody>
          </table>
          <p><strong>Multi-tenancy:</strong> All user-facing tables enforce <code>auth.uid() = user_id</code> via RLS. Groups support an <code>is_public</code> flag for read-only sharing.</p>

          <h2>3. External APIs</h2>
          <table>
            <thead><tr><th>Platform</th><th>API</th><th>Key Details</th></tr></thead>
            <tbody>
              <tr><td><strong>Google</strong></td><td>Places API (New) — <code>searchText</code></td><td>Stores <code>google_place_id</code> for future refreshes; supports manual ID override</td></tr>
              <tr><td><strong>TripAdvisor</strong></td><td>Apify scraper</td><td>Monthly quota-limited; URL-based scraping</td></tr>
              <tr><td><strong>Booking.com</strong></td><td>Apify scraper</td><td>Monthly quota-limited; URL-based scraping</td></tr>
              <tr><td><strong>Expedia</strong></td><td>Hotels.com API (RapidAPI)</td><td>Unified inventory with Hotels.com; auto-resolves missing aliases on-the-fly</td></tr>
              <tr><td><strong>Kasa.com</strong></td><td>Apify scraper</td><td>Portfolio sync of 79 verified properties; deduplicates on name+city+state</td></tr>
              <tr><td><strong>Gemini AI</strong></td><td>Lovable AI Gateway</td><td>Theme extraction, executive briefings, SWOT analysis</td></tr>
            </tbody>
          </table>

          <h3>Review Text Sources (for AI Analysis)</h3>
          <ul>
            <li><strong>Active:</strong> Google (Places API) + Expedia (Hotels.com RapidAPI) — ~10 s end-to-end</li>
            <li><strong>Inactive:</strong> TripAdvisor + Booking.com text fetching disabled for latency reasons</li>
          </ul>

          <h2>4. Scoring &amp; Normalization</h2>
          <p><strong>Universal 0–10 Scale:</strong></p>
          <ul>
            <li>Google / TripAdvisor / Expedia: raw (1–5) × 2</li>
            <li>Booking.com: already 0–10</li>
            <li>Kasa internal: raw (0–5) × 2</li>
          </ul>
          <p><strong>Weighted Averages:</strong> All composite scores use review-count weighting: <code>Σ(score × count) / Σ(count)</code></p>

          <table>
            <thead><tr><th>Tier</th><th>Range</th><th>UI Treatment</th></tr></thead>
            <tbody>
              <tr><td>Exceptional</td><td>9.5+</td><td>Gold star, green badge</td></tr>
              <tr><td>Wonderful</td><td>9.0–9.49</td><td>Gold star</td></tr>
              <tr><td>Very Good</td><td>8.0–8.99</td><td>Blue</td></tr>
              <tr><td>Good</td><td>7.0–7.99</td><td>Default</td></tr>
              <tr><td>Pleasant</td><td>6.0–6.99</td><td>Yellow</td></tr>
              <tr><td>Needs Work</td><td>&lt;6.0</td><td>Red</td></tr>
            </tbody>
          </table>

          <h2>5. AI-Powered Features</h2>

          <h3>Theme Analysis</h3>
          <ul>
            <li>Filters reviews: &gt;10 words, up to 50 per sentiment bucket (≥4★ positive, ≤2★ negative)</li>
            <li>Returns top 5 themes per bucket with mention counts + verbatim quotes</li>
            <li>Results cached in <code>review_analysis</code> table (one row per property)</li>
          </ul>

          <h3>Theme Normalization (Portfolio-level)</h3>
          <p>Similar themes consolidated via canonical mapping: "Cleanliness and Hygiene" → <strong>Cleanliness</strong>, "Prime Location" → <strong>Location</strong>, "Friendly Staff" → <strong>Staff &amp; Service</strong>.</p>

          <h3>Executive Briefing</h3>
          <p>Structured format: <code>🏆 HEADLINE → 📊 PORTFOLIO → 📡 CHANNELS → 💬 GUESTS SAY → 🎯 #1 ACTION</code></p>
          <p>Input data includes portfolio health metrics, OTA percentile rankings, theme analysis, top performers (≥9.5), and needs attention (&lt;7.0).</p>

          <h3>OTA Benchmarking</h3>
          <p>Kasa OTA averages calculated dynamically from weighted snapshot data. Percentiles computed by inserting Kasa's score into the comp distribution (Excel PERCENTRANK behavior).</p>

          <h2>6. Key Assumptions</h2>
          <ol>
            <li><strong>Normalization is linear</strong> — a 4.0/5 on Google equals 8.0/10 on Booking.com. No platform-specific calibration curves.</li>
            <li><strong>Review-count weighting</strong> — properties with more reviews influence group/portfolio averages proportionally.</li>
            <li><strong>Latest snapshot = current state</strong> — no decay/recency weighting on historical snapshots.</li>
            <li><strong>Kasa portfolio is 79 properties</strong> — synced from Kasa.com; duplicates resolved on name+city+state.</li>
            <li><strong>Comp set = all non-Kasa properties</strong> — any property without <code>kasa_url</code> is treated as a competitor.</li>
            <li><strong>AI themes are approximate</strong> — Gemini-generated themes may vary between runs; canonical mapping mitigates inconsistency.</li>
            <li><strong>Quota limits are external</strong> — RapidAPI and Apify monthly limits are outside application control; affected platforms show "—".</li>
          </ol>

          <h2>7. Performance Optimizations</h2>
          <ul>
            <li>TanStack Query 5-min staleTime across properties/snapshots</li>
            <li>Parallel review fetching (Google + Expedia simultaneously) for ~10 s analysis latency</li>
            <li>Snapshot deduplication via <code>cleanup_duplicate_snapshots</code> DB function</li>
            <li>Lazy/collapsed sections (Score Distribution collapsed by default on KasaSights)</li>
          </ul>

          <h2>8. Future Improvements</h2>

          <h3>Short-term</h3>
          <ul>
            <li>Date-range filtering on Dashboard trend charts</li>
            <li>Include AI executive briefing text in KasaSights CSV export</li>
            <li>Groups page CSV export</li>
            <li>Bulk property deletion</li>
          </ul>

          <h3>Medium-term</h3>
          <ul>
            <li>Re-enable TripAdvisor + Booking.com review text fetching</li>
            <li>Platform-specific calibration curves for cross-platform normalization</li>
            <li>Competitor auto-discovery (geography + star rating)</li>
            <li>Review response tracking and sentiment trends over time</li>
          </ul>

          <h3>Long-term</h3>
          <ul>
            <li>Real-time alerting when scores drop below threshold</li>
            <li>Revenue correlation (ADR/RevPAR alongside review scores)</li>
            <li>Multi-language review analysis</li>
            <li>White-label / multi-org support</li>
          </ul>

        </article>
      </div>
    </DashboardLayout>
  );
}
