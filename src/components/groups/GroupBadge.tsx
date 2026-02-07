import { Map } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Returns a score-band color dot class based on group name pattern.
 * Returns null if not a score-band group.
 */
export function getScoreBandDotColor(groupName: string): string | null {
  if (groupName.startsWith('Wonderful')) return 'bg-emerald-500';
  if (groupName.startsWith('Very Good')) return 'bg-blue-500';
  if (groupName.startsWith('Good')) return 'bg-yellow-500';
  if (groupName.startsWith('Pleasant')) return 'bg-orange-500';
  if (groupName.startsWith('Needs Work')) return 'bg-red-500';
  return null;
}

/**
 * Detects if a group name matches the state auto-group pattern.
 * Returns the state abbreviation or null.
 */
export function getStateFromGroupName(groupName: string): string | null {
  // Matches patterns like "CA_Comp Set", "NY_Kasa", "Texas_Comp Set"
  const match = groupName.match(/^(.+?)_(Comp Set|Kasa)$/);
  return match ? match[1] : null;
}

/**
 * A small badge displayed next to group names for auto-generated groups.
 */
export function GroupBadge({ groupName }: { groupName: string }) {
  // Score band dot
  const dotColor = getScoreBandDotColor(groupName);
  if (dotColor) {
    return (
      <span className={cn('inline-block h-2.5 w-2.5 rounded-full shrink-0', dotColor)} />
    );
  }

  // State badge
  const state = getStateFromGroupName(groupName);
  if (state) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
        <Map className="h-3 w-3" />
        {state}
      </span>
    );
  }

  return null;
}
