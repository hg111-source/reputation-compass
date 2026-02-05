import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

interface SortableTableHeadProps {
  children: React.ReactNode;
  sortKey: string;
  currentSort: string | null;
  currentDirection: SortDirection;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableTableHead({
  children,
  sortKey,
  currentSort,
  currentDirection,
  onSort,
  className,
}: SortableTableHeadProps) {
  const isActive = currentSort === sortKey;

  return (
    <TableHead
      className={cn(
        'cursor-pointer select-none',
        'hover:bg-muted/30',
        isActive && 'bg-muted/50',
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center justify-center gap-1.5">
        <span>{children}</span>
        <span className="flex h-4 w-4 items-center justify-center shrink-0">
          {isActive ? (
            currentDirection === 'asc' ? (
              <ChevronUp className="h-3.5 w-3.5 text-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-foreground" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/40" />
          )}
        </span>
      </div>
    </TableHead>
  );
}
