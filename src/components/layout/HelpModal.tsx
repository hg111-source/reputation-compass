import { useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

function CompsHelp() {
  return (
    <div className="space-y-5 text-sm text-muted-foreground">
      <section>
        <h3 className="font-semibold text-foreground mb-1">What Is This Page?</h3>
        <p>
          Comps is your central hub for tracking competitor hotel ratings across
          Google, TripAdvisor, Booking.com, and Expedia. Properties listed here are
          <span className="font-medium text-foreground"> not </span>
          Kasa listings — those live on the Kasa tab.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Adding Properties</h3>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <span className="font-medium text-foreground">Bulk Upload</span> — go to
            the <span className="font-medium text-foreground">Upload</span> page in the
            sidebar and import a CSV or Excel file with property names, cities, and
            states. Google Place IDs and OTA URLs are resolved automatically.
          </li>
          <li>
            <span className="font-medium text-foreground">Add Manually</span> — click
            <span className="font-medium text-foreground"> Add Property</span> in the
            toolbar. Start typing to autocomplete from Google, or enter details by hand.
          </li>
        </ul>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Refreshing Scores</h3>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <span className="font-medium text-foreground">Single Cell</span> — click
            the refresh icon on any platform score to re-fetch that rating.
          </li>
          <li>
            <span className="font-medium text-foreground">Single Row</span> — use the
            row-level refresh to update all four platforms for one property.
          </li>
          <li>
            <span className="font-medium text-foreground">Refresh All</span> — the
            toolbar button re-fetches every property across all platforms with a live
            progress dialog.
          </li>
        </ul>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Sorting, Filtering &amp; Views</h3>
        <p>
          Click any column header to sort. Use the
          <span className="font-medium text-foreground"> Group </span>
          dropdown to filter by group. Toggle between
          <span className="font-medium text-foreground"> Table </span> and
          <span className="font-medium text-foreground"> Card </span> views in the toolbar.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">AI Insights &amp; History</h3>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <span className="font-medium text-foreground">AI Insights</span> — click
            the brain icon on any row to generate an AI-powered sentiment summary.
            Cached results show an amber icon.
          </li>
          <li>
            <span className="font-medium text-foreground">Score History</span> — click
            the chart icon to see how scores have trended over time.
          </li>
          <li>
            <span className="font-medium text-foreground">Bulk Insights</span> — generate
            AI analysis for all properties at once.
          </li>
        </ul>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Score Legend</h3>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li><span className="font-medium text-foreground">Exceptional</span> — 9.5+</li>
          <li><span className="font-medium text-foreground">Wonderful</span> — 9.0–9.49</li>
          <li><span className="font-medium text-foreground">Very Good</span> — 8.0–8.99</li>
          <li><span className="font-medium text-foreground">Good</span> — 7.0–7.99</li>
          <li><span className="font-medium text-foreground">Pleasant</span> — 6.0–6.99</li>
          <li><span className="font-medium text-foreground">Needs Work</span> — below 6.0</li>
        </ul>
      </section>
    </div>
  );
}

function KasaHelp() {
  return (
    <div className="space-y-5 text-sm text-muted-foreground">
      <section>
        <h3 className="font-semibold text-foreground mb-1">What Is This Page?</h3>
        <p>
          The Kasa page manages your portfolio of Kasa-branded properties. It shows
          aggregated guest scores, review counts, property type, and location for
          every property sourced from kasa.com.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Sorting, Filtering &amp; Views</h3>
        <p>
          Use the <span className="font-medium text-foreground">location filter</span> to
          narrow properties by city or state. Click column headers to sort by name,
          location, score, or review count. Toggle between
          <span className="font-medium text-foreground"> Table </span> and
          <span className="font-medium text-foreground"> Card </span> views.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">AI Insights</h3>
        <p>
          Click the brain icon on any Kasa property to generate an AI-powered review
          analysis. Previously generated insights are cached (amber icon) — click
          again to view them without re-generating.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Refreshing Data</h3>
        <p>
          Click <span className="font-medium text-foreground">Refresh Data</span> to
          re-scrape all Kasa properties from kasa.com. Scores and review counts are
          updated safely — existing data is preserved if a property fails to scrape.
          A progress bar tracks the operation.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">How Scores Work</h3>
        <p>
          Each Kasa property's score is pulled directly from kasa.com. Kasa
          pre-aggregates guest ratings across multiple OTA platforms (Google,
          TripAdvisor, Booking.com, Expedia) into a single weighted composite — so
          the score shown here is already a cross-platform average.
        </p>
      </section>
    </div>
  );
}

function GroupsHelp() {
  return (
    <div className="space-y-5 text-sm text-muted-foreground">
      <section>
        <h3 className="font-semibold text-foreground mb-1">What Is This Page?</h3>
        <p>
          Groups let you organize properties into segments — by region, brand, score
          tier, or any custom criteria. Each group tracks a weighted average score so
          you can monitor portfolio-level trends.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Layout</h3>
        <p>
          Groups are organized into sections:
          <span className="font-medium text-foreground"> Portfolio</span> (including
          "Other" and portfolio-wide groups),
          <span className="font-medium text-foreground"> By Score</span>, and
          <span className="font-medium text-foreground"> By State</span>.
          Toggle between Card and Table views.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Creating Groups</h3>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <span className="font-medium text-foreground">Manual</span> — click
            <span className="font-medium text-foreground"> Create Group</span>, name it,
            and assign properties.
          </li>
          <li>
            <span className="font-medium text-foreground">Auto-Group</span> — use AI
            to automatically cluster properties by city, state, or score tier.
          </li>
        </ul>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Visibility</h3>
        <p>
          Groups can be <span className="font-medium text-foreground">Public</span> or
          <span className="font-medium text-foreground"> Private</span>. Toggle visibility
          from the table view. Public groups are included in portfolio-wide aggregations.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Navigating to Dashboard</h3>
        <p>
          Click any group card to jump to the Dashboard filtered for that group,
          showing detailed scores, platform breakdowns, and trend charts.
        </p>
      </section>
    </div>
  );
}

function DashboardHelp() {
  return (
    <div className="space-y-5 text-sm text-muted-foreground">
      <section>
        <h3 className="font-semibold text-foreground mb-1">What Is This Page?</h3>
        <p>
          The Dashboard gives you a portfolio-level overview of property performance.
          It defaults to showing all properties but can be filtered to a specific
          group using the dropdown next to the title.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Key Metrics</h3>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <span className="font-medium text-foreground">Weighted Average</span> —
            review-count-weighted average across all properties and platforms (0–10).
          </li>
          <li>
            <span className="font-medium text-foreground">Total Reviews</span> — combined
            review count across every platform.
          </li>
          <li>
            <span className="font-medium text-foreground">Properties</span> — total count
            and how many have active score data.
          </li>
        </ul>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Platform Breakdown</h3>
        <p>
          See how properties perform on each platform (Google, TripAdvisor,
          Booking.com, Expedia) with average scores and review distributions.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Group Filtering</h3>
        <p>
          Use the group selector to filter to a specific group. The dropdown shows
          property counts per group. You can also deep-link from the Groups page by
          clicking a group card.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Actions</h3>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <span className="font-medium text-foreground">Export</span> — download the
            current view as a CSV file.
          </li>
          <li>
            <span className="font-medium text-foreground">Refresh All</span> — re-fetch
            scores for every property across all platforms.
          </li>
        </ul>
      </section>
    </div>
  );
}

function KasaSightsHelp() {
  return (
    <div className="space-y-5 text-sm text-muted-foreground">
      <section>
        <h3 className="font-semibold text-foreground mb-1">What Is This Page?</h3>
        <p>
          KasaSights provides portfolio-wide guest sentiment analysis, comparing your
          Kasa properties against the Comps set. It's structured for executive
          scannability.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Page Flow</h3>
        <ol className="space-y-2 list-decimal list-inside">
          <li>
            <span className="font-medium text-foreground">Executive Briefing</span> — an
            AI-generated strategic summary of portfolio health, channel performance,
            and guest themes.
          </li>
          <li>
            <span className="font-medium text-foreground">Portfolio Scorecard</span> — a
            SWOT-style analysis of strengths, weaknesses, opportunities, and threats.
          </li>
          <li>
            <span className="font-medium text-foreground">Channel Benchmarks</span> — OTA
            percentile rankings showing where your portfolio stands on each platform.
          </li>
          <li>
            <span className="font-medium text-foreground">Theme Comparison</span> — a
            diverging bar chart comparing guest sentiment themes (e.g., cleanliness,
            location) between Kasa and Comps. Blue bars = Kasa, gray bars = Comps.
          </li>
          <li>
            <span className="font-medium text-foreground">Geographic Map</span> — a
            visual map of property locations and scores by state.
          </li>
          <li>
            <span className="font-medium text-foreground">Score Distribution</span> —
            shows how properties are distributed across score tiers.
          </li>
        </ol>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Generating the Briefing</h3>
        <p>
          Click <span className="font-medium text-foreground">Generate Briefing</span> to
          create or refresh the AI executive summary. The briefing is cached — it
          persists during tab navigation but refreshes on full page reload.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Reading the Theme Chart</h3>
        <p>
          Bars extending left represent Comps mention share; bars extending right
          represent Kasa mention share. Badges (Kasa+, Comp+, Even) indicate the
          leader for each theme. Hover for raw mention counts.
        </p>
      </section>
    </div>
  );
}

function UploadHelp() {
  return (
    <div className="space-y-5 text-sm text-muted-foreground">
      <section>
        <h3 className="font-semibold text-foreground mb-1">What Is This Page?</h3>
        <p>
          Upload lets you bulk-import competitor properties via CSV or Excel file.
          This is the fastest way to add many properties at once instead of entering
          them one by one on the Comps page.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">File Format</h3>
        <p>
          Your file should include columns for
          <span className="font-medium text-foreground"> Name</span>,
          <span className="font-medium text-foreground"> City</span>, and
          <span className="font-medium text-foreground"> State</span> at minimum.
          Both <span className="font-medium text-foreground">.csv</span> and
          <span className="font-medium text-foreground"> .xlsx</span> formats are
          supported. After upload, Google Place IDs and OTA platform URLs are resolved
          automatically.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">After Upload</h3>
        <p>
          Navigate to the <span className="font-medium text-foreground">Comps</span> page
          to see your imported properties. Use
          <span className="font-medium text-foreground"> Refresh All</span> to fetch
          scores across all platforms, or let the auto-heal system pick up missing
          scores automatically.
        </p>
      </section>
    </div>
  );
}

function DefaultHelp() {
  return (
    <div className="space-y-5 text-sm text-muted-foreground">
      <section>
        <h3 className="font-semibold text-foreground mb-1">Purpose</h3>
        <p>
          This dashboard aggregates guest review scores from multiple OTA platforms
          into a single, normalized view — giving operators a clear picture of
          property reputation across Google, TripAdvisor, Booking.com, and Expedia.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Weighted Score (0–10)</h3>
        <p>
          Each property's composite score is a review-count-weighted average of all
          platform scores, normalized to a 0–10 scale.
        </p>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li><span className="font-medium text-foreground">Exceptional</span> — 9.5+</li>
          <li><span className="font-medium text-foreground">Wonderful</span> — 9.0–9.49</li>
          <li><span className="font-medium text-foreground">Very Good</span> — 8.0–8.99</li>
          <li><span className="font-medium text-foreground">Good</span> — 7.0–7.99</li>
          <li><span className="font-medium text-foreground">Pleasant</span> — 6.0–6.99</li>
          <li><span className="font-medium text-foreground">Needs Work</span> — below 6.0</li>
        </ul>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Data Sources</h3>
        <ul className="space-y-1 list-disc list-inside">
          <li><span className="font-medium text-foreground">Google</span> — Places API</li>
          <li><span className="font-medium text-foreground">TripAdvisor</span> — scraped ratings</li>
          <li><span className="font-medium text-foreground">Booking.com</span> — scraped ratings</li>
          <li><span className="font-medium text-foreground">Expedia</span> — scraped ratings</li>
          <li><span className="font-medium text-foreground">Kasa</span> — aggregated guest scores</li>
        </ul>
      </section>
    </div>
  );
}
function ReadMeHelp() {
  return (
    <div className="space-y-5 text-sm text-muted-foreground">
      <section>
        <h3 className="font-semibold text-foreground mb-1">What Is This Page?</h3>
        <p>
          Read Me is the technical documentation and methodology reference for the
          Bravo Charts reputation intelligence platform. It provides context on
          <span className="font-medium text-foreground"> why </span> the tool was built,
          <span className="font-medium text-foreground"> how </span> it works, and
          <span className="font-medium text-foreground"> where </span> it's headed.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">What You'll Find</h3>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <span className="font-medium text-foreground">Context &amp; Goal</span> — the
            strategic rationale behind building an AI-native reputation dashboard.
          </li>
          <li>
            <span className="font-medium text-foreground">Core Functionality</span> — a
            summary of what the platform does across data aggregation, scoring, and analysis.
          </li>
          <li>
            <span className="font-medium text-foreground">Architecture &amp; Data Model</span> — the
            tech stack, table schema, and external data sources powering the system.
          </li>
          <li>
            <span className="font-medium text-foreground">Scoring &amp; Normalization</span> — how
            ratings from different platforms are normalized to a universal 0–10 scale.
          </li>
          <li>
            <span className="font-medium text-foreground">AI Features</span> — the models and
            prompting strategies used for sentiment analysis and executive briefings.
          </li>
          <li>
            <span className="font-medium text-foreground">Impact vs. Effort Roadmap</span> — a
            prioritized list (P0–P3) of future enhancements and their expected value.
          </li>
        </ul>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Who Is It For?</h3>
        <p>
          This page is designed for stakeholders evaluating the platform's methodology,
          engineers onboarding to the codebase, and leadership reviewing strategic
          direction and technical depth.
        </p>
      </section>
    </div>
  );
}

const pageConfig: Record<string, { title: string; description: string; label: string; Component: () => JSX.Element }> = {
  '/properties': {
    title: 'How to Use Comps',
    description: 'Track and compare competitor property ratings across OTA platforms.',
    label: 'How to Use',
    Component: CompsHelp,
  },
  '/kasa': {
    title: 'How to Use Kasa',
    description: 'Manage and monitor your Kasa property portfolio.',
    label: 'How to Use',
    Component: KasaHelp,
  },
  '/groups': {
    title: 'How to Use Groups',
    description: 'Organize properties into segments for portfolio analysis.',
    label: 'How to Use',
    Component: GroupsHelp,
  },
  '/dashboard': {
    title: 'How to Use Dashboard',
    description: 'Portfolio-level performance overview with group filtering.',
    label: 'How to Use',
    Component: DashboardHelp,
  },
  '/insights': {
    title: 'How to Use KasaSights',
    description: 'Portfolio-wide sentiment analysis comparing Kasa vs Comps.',
    label: 'How to Use',
    Component: KasaSightsHelp,
  },
  '/upload': {
    title: 'How to Use Upload',
    description: 'Bulk-import competitor properties via CSV or Excel.',
    label: 'How to Use',
    Component: UploadHelp,
  },
  '/readme': {
    title: 'About Read Me',
    description: 'Technical documentation, methodology, and roadmap reference.',
    label: 'How to Use',
    Component: ReadMeHelp,
  },
};

const defaultConfig = {
  title: 'How This Dashboard Works',
  description: 'A quick reference for the reputation tracking system.',
  label: 'Help',
  Component: DefaultHelp,
};

export function HelpModal() {
  const location = useLocation();
  const config = pageConfig[location.pathname] || defaultConfig;
  const { title, description, label, Component } = config;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full border-accent/40 bg-accent/10 px-4 text-accent hover:bg-accent/20 hover:text-accent"
          aria-label="Help"
        >
          <HelpCircle className="h-4 w-4" />
          <span className="text-xs font-semibold">{label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Component />
      </DialogContent>
    </Dialog>
  );
}
