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

function CompetitorsHelp() {
  return (
    <div className="space-y-5 text-sm text-muted-foreground">
      <section>
        <h3 className="font-semibold text-foreground mb-1">What Is This Page?</h3>
        <p>
          The Competitors page is your central hub for tracking how competing
          properties are rated across Google, TripAdvisor, Booking.com, and
          Expedia. Properties here are <span className="font-medium text-foreground">not</span> your
          Kasa listings — those live on the dedicated Kasa tab.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Adding Properties</h3>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <span className="font-medium text-foreground">Bulk Upload</span> — go to
            the <span className="font-medium text-foreground">Upload</span> page (sidebar)
            and import a CSV with property names, cities, and states. The system
            will automatically resolve Google Place IDs and OTA URLs.
          </li>
          <li>
            <span className="font-medium text-foreground">Add Manually</span> — click
            the <span className="font-medium text-foreground">Add Property</span> button
            in the top-right. Start typing a hotel name to auto-complete from Google,
            or enter details by hand. Scores are fetched automatically after adding.
          </li>
        </ul>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Refreshing Scores</h3>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <span className="font-medium text-foreground">Single Cell</span> — click
            the refresh icon on any individual platform score to re-fetch just that rating.
          </li>
          <li>
            <span className="font-medium text-foreground">Single Row</span> — use the
            row-level refresh to update all four platforms for one property.
          </li>
          <li>
            <span className="font-medium text-foreground">Refresh All</span> — the
            button at the top re-fetches every property across all platforms in one
            batch, with a live progress dialog.
          </li>
          <li>
            <span className="font-medium text-foreground">Resolve Pending</span> —
            re-attempts URL resolution for any property/platform that hasn't been matched yet.
          </li>
        </ul>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Sorting &amp; Filtering</h3>
        <p>
          Click any column header to sort ascending or descending. Use the
          <span className="font-medium text-foreground"> Group </span>
          dropdown to filter properties by group. Switch between
          <span className="font-medium text-foreground"> Table </span> and
          <span className="font-medium text-foreground"> Card </span> views with
          the toggle in the toolbar.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Insights &amp; History</h3>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <span className="font-medium text-foreground">AI Insights</span> — click
            the brain icon on any property row to generate an AI-powered summary of
            guest sentiment. Cached results show an amber icon.
          </li>
          <li>
            <span className="font-medium text-foreground">Score History</span> — click
            the chart icon on a property row to see how scores have trended over time.
          </li>
          <li>
            <span className="font-medium text-foreground">Bulk Insights</span> — use
            the bulk action to generate AI analysis for all properties at once.
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
          The Kasa page manages your portfolio of Kasa-branded properties. It displays
          aggregated guest scores, review counts, and city/state information for all
          properties sourced from the Kasa platform.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Filtering &amp; Sorting</h3>
        <p>
          Use the <span className="font-medium text-foreground">location filter</span> above the
          table to narrow properties by city or state. Click column headers to sort by name,
          location, score, or review count. Toggle between
          <span className="font-medium text-foreground"> Table </span> and
          <span className="font-medium text-foreground"> Card </span> views.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Property Types</h3>
        <p>
          Properties are distinguished by type (e.g., hotel, apartment). The type column
          helps you filter and compare performance across different property categories.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">AI Insights</h3>
        <p>
          Click the brain icon on any Kasa property row to generate an AI-powered review
          analysis. Previously generated insights are cached and indicated with an amber icon —
          click again to view the cached result without re-generating.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Refreshing Data</h3>
        <p>
          Kasa scores are synced from the Kasa platform. Use the refresh controls to
          re-fetch the latest aggregated scores and review counts for individual properties
          or the entire portfolio.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">📌 How Scores Work</h3>
        <p>
          The aggregated score shown for each Kasa property is pulled directly from
          <span className="font-medium text-foreground"> kasa.com</span>. Kasa pre-aggregates
          guest ratings across multiple OTA platforms (Google, TripAdvisor, Booking.com,
          Expedia) into a single weighted score — so what you see here is already a
          cross-platform composite.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">🔮 Future Improvements</h3>
        <p>
          <span className="font-medium text-foreground">Per-OTA Scores &amp; Reviews</span> —
          fetch individual scores and reviews from Google, TripAdvisor, Booking.com, and
          Expedia for each Kasa property. This would enable per-platform score breakdowns
          and sentiment analysis, similar to what the Competitors page offers today.
          Right now, the score shown is a single aggregate pulled from kasa.com.
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
          Groups let you organize properties into segments — by region, brand, score tier,
          or any custom criteria. Each group tracks a weighted average score over time so
          you can monitor portfolio-level trends.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Layout</h3>
        <p>
          Groups are organized into sections: <span className="font-medium text-foreground">Portfolio</span> (including
          "Other" and portfolio-wide groups) at the top, followed by
          <span className="font-medium text-foreground"> By Score</span> and
          <span className="font-medium text-foreground"> By State</span> sections.
          Switch between Card and Table views using the toggle.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Creating Groups</h3>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <span className="font-medium text-foreground">Manual</span> — click
            <span className="font-medium text-foreground"> Create Group</span>, name it,
            and assign properties from your portfolio.
          </li>
          <li>
            <span className="font-medium text-foreground">Auto-Group</span> — use the AI
            auto-group feature to automatically cluster properties by city, state, or
            score tier. This saves time when organizing large portfolios.
          </li>
        </ul>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Visibility</h3>
        <p>
          Groups can be set to <span className="font-medium text-foreground">Public</span> or
          <span className="font-medium text-foreground"> Private</span>. Toggle visibility
          directly from the table view. Public groups are included in portfolio-wide
          aggregations.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Navigating to Dashboard</h3>
        <p>
          Click any group card to navigate directly to the Dashboard filtered for that
          group, where you can see detailed scores, platform breakdowns, and trend charts.
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
          The Dashboard provides a portfolio-level overview of property performance. It
          defaults to showing all properties but can be filtered to a specific group using
          the group selector next to the title.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Key Metrics</h3>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <span className="font-medium text-foreground">Portfolio Weighted Average</span> —
            the review-count-weighted average across all properties and platforms, on a 0–10 scale.
          </li>
          <li>
            <span className="font-medium text-foreground">Total Reviews</span> — combined
            review count across all platforms and properties.
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
          See how properties perform on each platform (Google, TripAdvisor, Booking.com,
          Expedia) with average scores and review distributions.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Group Filtering</h3>
        <p>
          Use the group selector dropdown to filter the dashboard to a specific group.
          The dropdown shows property counts per group. You can also deep-link from the
          Groups page by clicking a group card.
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

function InsightsHelp() {
  return (
    <div className="space-y-5 text-sm text-muted-foreground">
      <section>
        <h3 className="font-semibold text-foreground mb-1">What Is This Page?</h3>
        <p>
          KasaSights provides portfolio-wide guest sentiment analysis comparing your
          Kasa properties against the Competitor set. It follows a structured narrative
          designed for executive scannability.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Page Flow</h3>
        <ol className="space-y-2 list-decimal list-inside">
          <li>
            <span className="font-medium text-foreground">Executive Briefing</span> — an
            AI-generated strategic summary of portfolio health, channel performance, and
            guest themes.
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
            location) between Kasa and competitors as a share of conversation.
          </li>
          <li>
            <span className="font-medium text-foreground">Geographic Map</span> — a visual
            map of property locations and scores by state.
          </li>
          <li>
            <span className="font-medium text-foreground">Score Distribution</span> —
            collapsed by default; shows how properties are distributed across score tiers.
          </li>
        </ol>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Generating the Briefing</h3>
        <p>
          Click the <span className="font-medium text-foreground">Generate Briefing</span> button
          to create or refresh the AI executive summary. The briefing is cached — it
          persists during tab navigation but refreshes on full page reload.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Reading the Theme Chart</h3>
        <p>
          Bars extending left represent Competitor strengths; bars extending right represent
          Kasa strengths. Badges (Kasa+, Comp+, Even) indicate the leader for each theme.
          Hover for raw mention counts.
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
          The Upload page allows you to bulk-import competitor properties via CSV file.
          This is the fastest way to add many properties at once instead of entering them
          one by one on the Competitors page.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">CSV Format</h3>
        <p>
          Your CSV file should include columns for <span className="font-medium text-foreground">name</span>,
          <span className="font-medium text-foreground"> city</span>, and
          <span className="font-medium text-foreground"> state</span> at minimum. After upload,
          the system automatically resolves Google Place IDs and OTA platform URLs for each property.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">After Upload</h3>
        <p>
          Once properties are imported, navigate to the <span className="font-medium text-foreground">Competitors</span> page
          to see them in your table. Use the <span className="font-medium text-foreground">Refresh All</span> button
          to fetch scores across all platforms, or let the auto-heal system pick up
          any missing scores automatically.
        </p>
      </section>
    </div>
  );
}

const pageConfig: Record<string, { title: string; description: string; label: string; Component: () => JSX.Element }> = {
  '/properties': {
    title: 'How to Use Competitors',
    description: 'Everything you need to know about tracking competitor properties.',
    label: 'How to Use',
    Component: CompetitorsHelp,
  },
  '/kasa': {
    title: 'How to Use Kasa',
    description: 'Managing your Kasa property portfolio.',
    label: 'How to Use',
    Component: KasaHelp,
  },
  '/groups': {
    title: 'How to Use Groups',
    description: 'Organizing properties into segments for analysis.',
    label: 'How to Use',
    Component: GroupsHelp,
  },
  '/dashboard': {
    title: 'How to Use Dashboard',
    description: 'Portfolio-level performance overview.',
    label: 'How to Use',
    Component: DashboardHelp,
  },
  '/insights': {
    title: 'How to Use KasaSights',
    description: 'Portfolio-wide sentiment analysis and strategic insights.',
    label: 'How to Use',
    Component: InsightsHelp,
  },
  '/upload': {
    title: 'How to Use Upload',
    description: 'Bulk-importing properties via CSV.',
    label: 'How to Use',
    Component: UploadHelp,
  },
};

const defaultConfig = {
  title: 'How This Dashboard Works',
  description: 'A quick reference for the reputation tracking system.',
  label: 'Help',
  Component: DefaultHelp,
};

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
