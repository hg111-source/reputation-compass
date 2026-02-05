import { useState } from 'react';
import { MapPin, Map, TrendingUp, Loader2, Check, FolderPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Property, ReviewSource } from '@/lib/types';
import { useAutoGroup, AutoGroupStrategy } from '@/hooks/useAutoGroup';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AutoGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  scores: Record<string, Record<ReviewSource, { score: number; count: number }> | undefined>;
}

interface GroupOption {
  id: AutoGroupStrategy;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const GROUP_OPTIONS: GroupOption[] = [
  {
    id: 'city',
    title: 'Group by City',
    description: 'Create groups like "Boston Properties", "New York Properties"',
    icon: MapPin,
    color: 'text-blue-500',
  },
  {
    id: 'state',
    title: 'Group by State',
    description: 'Create groups like "California Properties", "Massachusetts Properties"',
    icon: Map,
    color: 'text-emerald-500',
  },
  {
    id: 'score',
    title: 'Group by Score',
    description: 'Create "Top Performers (9.0+)", "Strong (8.0-8.9)", "Needs Attention"',
    icon: TrendingUp,
    color: 'text-amber-500',
  },
];

export function AutoGroupDialog({ open, onOpenChange, properties, scores }: AutoGroupDialogProps) {
  const { generateGroups, createAutoGroups } = useAutoGroup();
  const { toast } = useToast();
  const [selectedStrategy, setSelectedStrategy] = useState<AutoGroupStrategy | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [preview, setPreview] = useState<{ name: string; count: number }[] | null>(null);

  const handleSelectStrategy = (strategy: AutoGroupStrategy) => {
    setSelectedStrategy(strategy);
    const groups = generateGroups(properties, scores, strategy);
    setPreview(groups.map(g => ({ name: g.name, count: g.propertyIds.length })));
  };

  const handleCreate = async () => {
    if (!selectedStrategy) return;
    
    setIsCreating(true);
    try {
      const groups = generateGroups(properties, scores, selectedStrategy);
      const created = await createAutoGroups.mutateAsync(groups);
      
      toast({
        title: 'Groups created',
        description: `Created ${created.length} groups successfully.`,
      });
      
      onOpenChange(false);
      setSelectedStrategy(null);
      setPreview(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create groups.',
      });
    }
    setIsCreating(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedStrategy(null);
    setPreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-accent" />
            Smart Auto-Grouping
          </DialogTitle>
          <DialogDescription>
            Automatically organize your {properties.length} properties into groups
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {GROUP_OPTIONS.map((option) => {
            const isSelected = selectedStrategy === option.id;
            const Icon = option.icon;
            
            return (
              <button
                key={option.id}
                onClick={() => handleSelectStrategy(option.id)}
                className={cn(
                  'w-full rounded-lg border p-4 text-left transition-all',
                  isSelected
                    ? 'border-accent bg-accent/5 ring-2 ring-accent'
                    : 'border-border hover:border-accent/50 hover:bg-muted/30'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5', option.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{option.title}</span>
                      {isSelected && <Check className="h-4 w-4 text-accent" />}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {preview && preview.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="mb-3 text-sm font-medium">Preview ({preview.length} groups):</p>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {preview.map((group, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span>{group.name}</span>
                  <span className="text-muted-foreground">
                    {group.count} {group.count === 1 ? 'property' : 'properties'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {preview && preview.length === 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            No groups would be created with this strategy.
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleCreate}
            disabled={!selectedStrategy || isCreating || (preview && preview.length === 0)}
            className="flex-1"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>Create {preview?.length || 0} Groups</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
