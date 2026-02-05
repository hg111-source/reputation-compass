import { useState, useMemo } from 'react';
import { MapPin, Map, TrendingUp, Loader2, Check, FolderPlus, CheckSquare, XSquare, Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface ScoreThresholds {
  elite: number;
  strong: number;
  attention: number;
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

const DEFAULT_THRESHOLDS: ScoreThresholds = {
  elite: 9.0,
  strong: 8.0,
  attention: 0,
};

export function AutoGroupDialog({ open, onOpenChange, properties, scores }: AutoGroupDialogProps) {
  const { generateGroups, generateGroupsWithThresholds, createAutoGroups } = useAutoGroup();
  const { toast } = useToast();
  const [selectedStrategy, setSelectedStrategy] = useState<AutoGroupStrategy | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);
  const [thresholds, setThresholds] = useState<ScoreThresholds>(DEFAULT_THRESHOLDS);
  const [preview, setPreview] = useState<{ name: string; count: number; propertyIds: string[] }[] | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  const handleSelectStrategy = (strategy: AutoGroupStrategy) => {
    setSelectedStrategy(strategy);
    const groups = strategy === 'score' 
      ? generateGroupsWithThresholds(properties, scores, thresholds)
      : generateGroups(properties, scores, strategy);
    const previewData = groups.map(g => ({ name: g.name, count: g.propertyIds.length, propertyIds: g.propertyIds }));
    setPreview(previewData);
    // Select all groups by default
    setSelectedGroups(new Set(previewData.map(g => g.name)));
  };

  const handleUpdateThresholds = (newThresholds: ScoreThresholds) => {
    setThresholds(newThresholds);
    if (selectedStrategy === 'score') {
      const groups = generateGroupsWithThresholds(properties, scores, newThresholds);
      const previewData = groups.map(g => ({ name: g.name, count: g.propertyIds.length, propertyIds: g.propertyIds }));
      setPreview(previewData);
      setSelectedGroups(new Set(previewData.map(g => g.name)));
    }
  };

  const handleToggleGroup = (groupName: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupName)) {
      newSelected.delete(groupName);
    } else {
      newSelected.add(groupName);
    }
    setSelectedGroups(newSelected);
  };

  const handleSelectAll = () => {
    if (preview) {
      setSelectedGroups(new Set(preview.map(g => g.name)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedGroups(new Set());
  };

  const selectedPreview = useMemo(() => {
    return preview?.filter(g => selectedGroups.has(g.name)) || [];
  }, [preview, selectedGroups]);

  const handleCreate = async () => {
    if (!selectedStrategy || selectedPreview.length === 0) return;
    
    setIsCreating(true);
    try {
      // Only create selected groups
      const groupsToCreate = selectedPreview.map(g => ({
        name: g.name,
        propertyIds: g.propertyIds,
      }));
      
      const created = await createAutoGroups.mutateAsync(groupsToCreate);
      
      toast({
        title: 'Groups created',
        description: `Created ${created.length} groups successfully.`,
      });
      
      onOpenChange(false);
      resetState();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create groups.',
      });
    }
    setIsCreating(false);
  };

  const resetState = () => {
    setSelectedStrategy(null);
    setPreview(null);
    setSelectedGroups(new Set());
    setShowThresholds(false);
    setThresholds(DEFAULT_THRESHOLDS);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetState();
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

        {/* Score Threshold Customization */}
        {selectedStrategy === 'score' && (
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <button
              onClick={() => setShowThresholds(!showThresholds)}
              className="flex w-full items-center justify-between text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Customize Score Thresholds
              </span>
              <span className="text-muted-foreground">
                {showThresholds ? '−' : '+'}
              </span>
            </button>
            
            {showThresholds && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="elite-threshold" className="text-xs">
                      Top Performers (≥)
                    </Label>
                    <Input
                      id="elite-threshold"
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={thresholds.elite}
                      onChange={(e) => handleUpdateThresholds({
                        ...thresholds,
                        elite: parseFloat(e.target.value) || 0,
                      })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="strong-threshold" className="text-xs">
                      Strong (≥)
                    </Label>
                    <Input
                      id="strong-threshold"
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={thresholds.strong}
                      onChange={(e) => handleUpdateThresholds({
                        ...thresholds,
                        strong: parseFloat(e.target.value) || 0,
                      })}
                      className="h-9"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Properties below {thresholds.strong} will be in "Needs Attention"
                </p>
              </div>
            )}
          </div>
        )}

        {/* Preview with Checkboxes */}
        {preview && preview.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">
                Select groups to create ({selectedGroups.size} of {preview.length})
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleSelectAll}
                  className="h-7 px-2 text-xs"
                >
                  <CheckSquare className="mr-1 h-3 w-3" />
                  All
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleDeselectAll}
                  className="h-7 px-2 text-xs"
                >
                  <XSquare className="mr-1 h-3 w-3" />
                  None
                </Button>
              </div>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {preview.map((group, idx) => (
                <label
                  key={idx}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors',
                    selectedGroups.has(group.name)
                      ? 'border-accent/50 bg-accent/5'
                      : 'border-transparent hover:bg-muted/50'
                  )}
                >
                  <Checkbox
                    checked={selectedGroups.has(group.name)}
                    onCheckedChange={() => handleToggleGroup(group.name)}
                    className="data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                  />
                  <div className="flex flex-1 items-center justify-between">
                    <span className="text-sm font-medium">{group.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {group.count} {group.count === 1 ? 'property' : 'properties'}
                    </span>
                  </div>
                </label>
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
            disabled={!selectedStrategy || isCreating || selectedPreview.length === 0}
            className="flex-1"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>Create {selectedPreview.length} Groups</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
