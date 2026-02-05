import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGroups, useGroupProperties } from '@/hooks/useGroups';
import { useProperties } from '@/hooks/useProperties';
import { useGroupMetrics } from '@/hooks/useGroupMetrics';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, FolderOpen, Settings, CheckSquare, XSquare, Search, Building2, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getScoreColor, formatScore } from '@/lib/scoring';
import { cn } from '@/lib/utils';

export default function Groups() {
  const { user, loading } = useAuth();
  const { groups, isLoading, createGroup, deleteGroup } = useGroups();
  const { properties } = useProperties();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;

    try {
      await createGroup.mutateAsync(name);
      toast({ title: 'Group created', description: `${name} has been created.` });
      setIsCreateOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create group.' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteGroup.mutateAsync(id);
      toast({ title: 'Group deleted', description: `${name} has been removed.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete group.' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Groups</h1>
            <p className="mt-2 text-muted-foreground">
              Organize properties into groups for comparison
            </p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Plus className="mr-2 h-4 w-4" />
                Create Group
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl">Create Group</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-5 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Group Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g., NYC Competitive Set"
                    className="h-12 rounded-md"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  variant="secondary"
                  className="h-12 w-full" 
                  disabled={createGroup.isPending}
                >
                  {createGroup.isPending ? 'Creating...' : 'Create Group'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span>Loading groups...</span>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-20 text-center shadow-kasa">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-8 text-2xl font-semibold">No groups yet</h3>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Create groups to organize and compare properties.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {groups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                onDelete={() => handleDelete(group.id, group.name)}
                onManage={() => setSelectedGroupId(group.id)}
                isSelected={selectedGroupId === group.id}
              />
            ))}
          </div>
        )}

        {selectedGroupId && (
          <GroupPropertiesManager
            groupId={selectedGroupId}
            allProperties={properties}
            onClose={() => setSelectedGroupId(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function GroupCard({
  group,
  onDelete,
  onManage,
  isSelected,
}: {
  group: { id: string; name: string; created_at: string };
  onDelete: () => void;
  onManage: () => void;
  isSelected: boolean;
}) {
  const { avgScore, totalProperties, totalReviews, isLoading } = useGroupMetrics(group.id);

  return (
    <Card className={`shadow-kasa transition-all hover:shadow-kasa-hover ${isSelected ? 'ring-2 ring-accent' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold">{group.name}</CardTitle>
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 text-muted-foreground hover:text-foreground" 
            onClick={onManage}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Group Weighted Average Score - Primary metric */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mb-5 flex items-center justify-center rounded-xl bg-muted/50 py-4 cursor-help">
                {isLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                ) : avgScore !== null ? (
                  <div className="text-center">
                    <div className={cn('text-4xl font-bold', getScoreColor(avgScore))}>
                      {formatScore(avgScore)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Weighted Avg</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-4xl font-bold text-muted-foreground">—</div>
                    <p className="mt-1 text-xs text-muted-foreground">No data</p>
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-semibold">Group Weighted Average</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Σ(hotel_avg × hotel_reviews) ÷ Σ(hotel_reviews)
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Hotels with more reviews have greater influence on this score.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xl font-bold">{totalProperties}</div>
              <p className="text-xs text-muted-foreground">
                {totalProperties === 1 ? 'property' : 'properties'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-xl font-bold">{totalReviews.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">reviews</p>
            </div>
          </div>
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          Created {format(new Date(group.created_at), 'MMM d, yyyy')}
        </p>
      </CardContent>
    </Card>
  );
}

function GroupPropertiesManager({
  groupId,
  allProperties,
  onClose,
}: {
  groupId: string;
  allProperties: Array<{ id: string; name: string; city: string; state: string }>;
  onClose: () => void;
}) {
  const { 
    properties: groupProperties, 
    addPropertyToGroup, 
    removePropertyFromGroup,
    bulkAddAllProperties,
    bulkRemoveAllProperties,
  } = useGroupProperties(groupId);
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const groupPropertyIds = new Set(groupProperties.map(p => p.id));

  const filteredProperties = useMemo(() => {
    if (!searchQuery.trim()) return allProperties;
    const query = searchQuery.toLowerCase();
    return allProperties.filter(
      p =>
        p.name.toLowerCase().includes(query) ||
        p.city.toLowerCase().includes(query) ||
        p.state.toLowerCase().includes(query)
    );
  }, [allProperties, searchQuery]);

  const propertiesToAdd = allProperties.filter(p => !groupPropertyIds.has(p.id));

  const handleSelectAll = async () => {
    if (propertiesToAdd.length === 0) return;
    setIsProcessing(true);
    try {
      const result = await bulkAddAllProperties.mutateAsync({
        groupId,
        propertyIds: propertiesToAdd.map(p => p.id),
      });
      toast({ title: 'Added properties', description: `Added ${result.count} properties to group.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add properties.' });
    }
    setIsProcessing(false);
  };

  const handleClearAll = async () => {
    if (groupPropertyIds.size === 0) return;
    setIsProcessing(true);
    try {
      const result = await bulkRemoveAllProperties.mutateAsync(groupId);
      toast({ title: 'Removed properties', description: `Removed ${result.count} properties from group.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove properties.' });
    }
    setIsProcessing(false);
  };

  const handleToggle = async (propertyId: string, isInGroup: boolean) => {
    try {
      if (isInGroup) {
        await removePropertyFromGroup.mutateAsync({ groupId, propertyId });
        toast({ title: 'Removed', description: 'Property removed from group.' });
      } else {
        await addPropertyToGroup.mutateAsync({ groupId, propertyId });
        toast({ title: 'Added', description: 'Property added to group.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update group.' });
    }
  };

  return (
    <Card className="shadow-kasa">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border">
        <CardTitle className="text-xl">Manage Properties</CardTitle>
        <Button variant="outline" size="sm" onClick={onClose}>
          Done
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="mb-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search properties..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-12 rounded-lg pl-11"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={isProcessing || propertiesToAdd.length === 0}
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              Select All ({propertiesToAdd.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={isProcessing || groupPropertyIds.size === 0}
            >
              <XSquare className="mr-2 h-4 w-4" />
              Clear All ({groupPropertyIds.size})
            </Button>
          </div>
        </div>
        {allProperties.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">
            No properties available. Upload or add properties first.
          </p>
        ) : (
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {filteredProperties.map(property => {
              const isInGroup = groupPropertyIds.has(property.id);
              return (
                <div
                  key={property.id}
                  className={`flex items-center space-x-4 rounded-xl border p-4 transition-colors ${
                    isInGroup ? 'border-accent/30 bg-accent/5' : 'border-border bg-card hover:bg-muted/30'
                  }`}
                >
                  <Checkbox
                    id={property.id}
                    checked={isInGroup}
                    onCheckedChange={() => handleToggle(property.id, isInGroup)}
                    className="data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                  />
                  <label htmlFor={property.id} className="flex-1 cursor-pointer">
                    <div className="font-medium">{property.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {property.city}, {property.state}
                    </div>
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
