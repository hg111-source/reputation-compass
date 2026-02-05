import { cn } from '@/lib/utils';
import { formatScore, getScoreColor } from '@/lib/scoring';

interface ScoreCellProps {
  score: number | null | undefined;
  count?: number;
  showCount?: boolean;
  isWeighted?: boolean;
}

export function ScoreCell({ score, count, showCount = true, isWeighted = false }: ScoreCellProps) {
  const formattedScore = formatScore(score);
  const colorClass = getScoreColor(score ?? null);

  return (
    <div className="text-center">
      <div className={cn(
        'font-semibold',
        isWeighted ? 'text-base' : 'text-sm',
        colorClass
      )}>
        {formattedScore}
      </div>
      {showCount && count !== undefined && (
        <div className="text-xs text-muted-foreground">
          {count > 0 ? `${count} reviews` : '—'}
        </div>
      )}
    </div>
  );
}
