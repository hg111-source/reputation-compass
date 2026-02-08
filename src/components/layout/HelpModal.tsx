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
            the refresh icon on any individual platform score to re-fetch just that
            rating.
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
            re-attempts URL resolution for any property/platform that hasn't been
            matched yet.
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
            guest sentiment from collected reviews. Cached results show an amber icon.
          </li>
          <li>
            <span className="font-medium text-foreground">Score History</span> — click
            the chart icon on a property row to see how its scores have trended over
            time across all platforms.
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
          platform scores, normalized to a 0–10 scale. Platforms with more reviews
          carry proportionally more weight.
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
        <h3 className="font-semibold text-foreground mb-1">Smart Groups</h3>
        <p>
          Groups let you segment properties by region, brand, or any custom criteria.
          The <span className="font-medium text-foreground">Auto-Group</span> feature
          uses AI to cluster properties automatically. Group snapshots track the
          weighted average over time.
        </p>
      </section>

      <Separator />

      <section>
        <h3 className="font-semibold text-foreground mb-1">Data Sources</h3>
        <ul className="space-y-1 list-disc list-inside">
          <li><span className="font-medium text-foreground">Google</span> — Places API ratings &amp; review counts</li>
          <li><span className="font-medium text-foreground">TripAdvisor</span> — scraped ratings &amp; review counts</li>
          <li><span className="font-medium text-foreground">Booking.com</span> — scraped ratings &amp; review counts</li>
          <li><span className="font-medium text-foreground">Expedia</span> — scraped ratings &amp; review counts</li>
          <li><span className="font-medium text-foreground">Kasa</span> — aggregated guest scores from the Kasa platform</li>
        </ul>
      </section>
    </div>
  );
}

export function HelpModal() {
  const location = useLocation();
  const isCompetitors = location.pathname === '/properties';

  const title = isCompetitors ? 'How to Use Competitors' : 'How This Dashboard Works';
  const description = isCompetitors
    ? 'Everything you need to know about tracking competitor properties.'
    : 'A quick reference for the reputation tracking system.';

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
          <span className="text-xs font-semibold">
            {isCompetitors ? 'How to Use' : 'Help'}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {isCompetitors ? <CompetitorsHelp /> : <DefaultHelp />}
      </DialogContent>
    </Dialog>
  );
}
