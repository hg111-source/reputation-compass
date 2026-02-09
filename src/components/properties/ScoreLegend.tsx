import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const SCORE_TIERS = [
  { min: 9, label: 'Wonderful', color: 'bg-emerald-600' },
  { min: 8, label: 'Very Good', color: 'bg-foreground/70' },
  { min: 7, label: 'Good', color: 'bg-foreground/70' },
  { min: 6, label: 'Pleasant', color: 'bg-amber-600' },
  { min: 0, label: 'Needs Work', color: 'bg-red-600' },
];

interface ScoreLegendProps {
  className?: string;
}

export function ScoreLegend({ className }: ScoreLegendProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors', className)}>
          <Info className="h-3.5 w-3.5" />
          <span>Score guide</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3" align="start">
        <p className="mb-2 text-xs font-medium text-foreground">Score Legend</p>
        <div className="space-y-1.5">
          {SCORE_TIERS.map((tier, i) => (
            <div key={tier.label} className="flex items-center gap-2 text-xs">
              <span className={cn('h-2.5 w-2.5 rounded-full', tier.color)} />
              <span className="text-muted-foreground">
                {tier.min === 0 ? '<6' : `${tier.min}+`}
              </span>
              <span className="text-foreground">{tier.label}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
