import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

  const getSortLabel = () => {
    if (!isActive) return 'Click to sort';
    if (currentDirection === 'desc') return 'Sorted descending. Click for ascending';
    return 'Sorted ascending. Click to clear';
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <TableHead
            className={cn(
              'cursor-pointer select-none transition-colors',
              'border-b-2 border-transparent hover:bg-muted/30',
              isActive && 'bg-muted/50 border-foreground/50',
              'group',
              className
            )}
            onClick={() => onSort(sortKey)}
          >
            <div className="flex items-center justify-center gap-1.5">
              <span className={cn(isActive && 'font-semibold')}>{children}</span>
              <span className="flex h-4 w-4 items-center justify-center">
                {isActive ? (
                  currentDirection === 'asc' ? (
                    <ChevronUp className="h-3.5 w-3.5 text-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-foreground" />
                  )
                ) : (
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
                )}
              </span>
            </div>
          </TableHead>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {getSortLabel()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
