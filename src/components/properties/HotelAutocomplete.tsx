import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { MapPin, Loader2 } from 'lucide-react';

interface Prediction {
  placeId: string;
  name: string;
  description: string;
  fullDescription: string;
}

interface PlaceDetails {
  name: string;
  city: string;
  state: string;
  websiteUrl: string | null;
}

interface HotelAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (details: PlaceDetails) => void;
  placeholder?: string;
  className?: string;
}

export function HotelAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Search for a hotel...',
  className,
}: HotelAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.length < 2) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('place-autocomplete', {
          body: { input: value, action: 'autocomplete' },
        });

        if (error) throw error;
        setPredictions(data.predictions || []);
        setShowDropdown(true);
        setSelectedIndex(-1);
      } catch (err) {
        console.error('Autocomplete error:', err);
        setPredictions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value]);

  const handleSelect = async (prediction: Prediction) => {
    setIsLoading(true);
    setShowDropdown(false);
    onChange(prediction.name);

    try {
      const { data, error } = await supabase.functions.invoke('place-autocomplete', {
        body: { action: 'details', placeId: prediction.placeId },
      });

      if (error) throw error;

      onSelect({
        name: data.name,
        city: data.city,
        state: data.state,
        websiteUrl: data.websiteUrl,
      });
    } catch (err) {
      console.error('Error fetching place details:', err);
      // Still use the prediction name even if details fail
      onSelect({
        name: prediction.name,
        city: '',
        state: '',
        websiteUrl: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || predictions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < predictions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(predictions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className={cn('h-12 rounded-md pr-10', className)}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {showDropdown && predictions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          <ul className="max-h-60 overflow-auto py-1">
            {predictions.map((prediction, index) => (
              <li
                key={prediction.placeId}
                onClick={() => handleSelect(prediction)}
                className={cn(
                  'flex cursor-pointer items-start gap-2 px-3 py-2 text-sm transition-colors',
                  'hover:bg-muted',
                  index === selectedIndex && 'bg-muted'
                )}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{prediction.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {prediction.description}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
