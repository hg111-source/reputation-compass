import { Property } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OTASource } from '@/hooks/useOTARatings';

interface PlatformRefreshButtonsProps {
  property: Property;
  onRefresh: (property: Property, source: OTASource) => void;
  loadingSource: OTASource | null;
  disabled?: boolean;
}

const PLATFORM_STYLES: Record<OTASource, { bg: string; hover: string; text: string; label: string }> = {
  tripadvisor: {
    bg: 'bg-orange-500/10',
    hover: 'hover:bg-orange-500/20',
    text: 'text-orange-600 dark:text-orange-400',
    label: 'TA',
  },
  booking: {
    bg: 'bg-blue-500/10',
    hover: 'hover:bg-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    label: 'B.com',
  },
  expedia: {
    bg: 'bg-purple-500/10',
    hover: 'hover:bg-purple-500/20',
    text: 'text-purple-600 dark:text-purple-400',
    label: 'Exp',
  },
};

export function PlatformRefreshButtons({
  property,
  onRefresh,
  loadingSource,
  disabled = false,
}: PlatformRefreshButtonsProps) {
  return (
    <div className="flex gap-1">
      {(Object.keys(PLATFORM_STYLES) as OTASource[]).map(source => {
        const style = PLATFORM_STYLES[source];
        const isLoading = loadingSource === source;
        
        return (
          <Button
            key={source}
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2 text-xs',
              style.bg,
              style.hover,
              style.text
            )}
            onClick={() => onRefresh(property, source)}
            disabled={disabled || isLoading}
          >
            {isLoading ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              style.label
            )}
          </Button>
        );
      })}
    </div>
  );
}
