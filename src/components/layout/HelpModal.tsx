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

export function HelpModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full px-3 text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label="Help"
        >
          <HelpCircle className="h-4 w-4" />
          <span className="text-xs font-medium">Help</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">How This Dashboard Works</DialogTitle>
          <DialogDescription>
            A quick reference for the reputation tracking system.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm text-muted-foreground">
          {/* Purpose */}
          <section>
            <h3 className="font-semibold text-foreground mb-1">Purpose</h3>
            <p>
              This dashboard aggregates guest review scores from multiple OTA platforms
              into a single, normalized view — giving operators a clear picture of
              property reputation across Google, TripAdvisor, Booking.com, and Expedia.
            </p>
          </section>

          <Separator />

          {/* Weighted Score */}
          <section>
            <h3 className="font-semibold text-foreground mb-1">Weighted Score (0–10)</h3>
            <p>
              Each property's composite score is a review-count-weighted average of all
              platform scores, normalized to a 0–10 scale. Platforms with more reviews
              carry proportionally more weight, reflecting where guests are most vocal.
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

          {/* Smart Groups */}
          <section>
            <h3 className="font-semibold text-foreground mb-1">Smart Groups</h3>
            <p>
              Groups let you segment properties by region, brand, or any custom criteria.
              The <span className="font-medium text-foreground">Auto-Group</span> feature
              uses AI to cluster properties by city, state, or score tier automatically.
              Group snapshots track the weighted average over time so you can spot
              portfolio-level trends.
            </p>
          </section>

          <Separator />

          {/* Data Sources */}
          <section>
            <h3 className="font-semibold text-foreground mb-1">Data Sources</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li><span className="font-medium text-foreground">Google</span> — Places API ratings &amp; review counts</li>
              <li><span className="font-medium text-foreground">TripAdvisor</span> — scraped ratings &amp; review counts</li>
              <li><span className="font-medium text-foreground">Booking.com</span> — scraped ratings &amp; review counts</li>
              <li><span className="font-medium text-foreground">Expedia</span> — scraped ratings &amp; review counts</li>
              <li><span className="font-medium text-foreground">Kasa</span> — aggregated guest scores from the Kasa platform</li>
            </ul>
            <p className="mt-2">
              Scores refresh on-demand per property or in bulk via the refresh controls
              on the Properties page.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
