import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, Lightbulb, BarChart3, Clock, TrendingUp } from 'lucide-react';

const METRICS = [
  { label: 'Owner NPS Score', icon: BarChart3 },
  { label: 'Response Time Rating', icon: Clock },
  { label: 'Revenue vs Projections', icon: TrendingUp },
];

const FUTURE_SOURCES = [
  'Owner satisfaction surveys',
  'Support ticket sentiment',
  'Contract renewal rates',
  'Maintenance request feedback',
];

export function PropertyOwnerInsights() {
  return (
    <Card className="bg-muted/30">
      <CardContent className="pt-6 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <Home className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Property Owner Insights</h2>
              <p className="text-xs text-muted-foreground">The other side of the guest experience</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Guest reviews show the stay experience. Owner feedback shows the management experience. Together, they complete the picture.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {METRICS.map(m => (
            <div key={m.label} className="rounded-lg border border-dashed bg-muted/40 p-3">
              <m.icon className="h-4 w-4 text-muted-foreground/50 mb-1.5" />
              <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
              <p className="text-lg font-bold text-muted-foreground/30 mt-1">——</p>
            </div>
          ))}
        </div>

        <div className="flex gap-6">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Future data sources:</p>
            <ul className="space-y-0.5">
              {FUTURE_SOURCES.map(s => (
                <li key={s} className="text-xs text-muted-foreground/70 flex gap-1.5">
                  <span>•</span>{s}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex-1 rounded-lg border bg-background/60 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs font-bold">Why track owner feedback?</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Property owners are Kasa's other customer. Their satisfaction drives portfolio growth (referrals), contract renewals, and brand reputation in the market.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
