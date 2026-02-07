import { useState, useMemo } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGroups, useGroupProperties } from '@/hooks/useGroups';
import { useProperties } from '@/hooks/useProperties';
import { useGroupMetrics } from '@/hooks/useGroupMetrics';
import { useAllGroupMetrics } from '@/hooks/useAllGroupMetrics';
import { useLatestPropertyScores } from '@/hooks/useSnapshots';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Plus, Trash2, FolderOpen, Settings, CheckSquare, XSquare, Search, 
  Building2, MessageSquare, Wand2, MoreVertical, Pencil, Download, RefreshCw,
  Globe, Sparkles, Copy, Lock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getScoreColor, formatScore, calculatePropertyMetrics } from '@/lib/scoring';
import { cn } from '@/lib/utils';
import { AutoGroupDialog } from '@/components/groups/AutoGroupDialog';
import { GroupAnalysisDialog } from '@/components/groups/GroupAnalysisDialog';
import { GroupBadge } from '@/components/groups/GroupBadge';
import { ReviewSource } from '@/lib/types';
import { exportGroupToCSV } from '@/lib/csv';

export default function Groups() {
  const { user, loading } = useAuth();
  const { myGroups, publicGroups, isLoading, createGroup, deleteGroup, updateGroup, copyGroup } = useGroups();
  const { properties } = useProperties();
  const propertyIds = properties.map(p => p.id);
  const { data: scores = {} } = useLatestPropertyScores(propertyIds);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAutoGroupOpen, setIsAutoGroupOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [newGroupPublic, setNewGroupPublic] = useState(false);

  // Get sorted groups by score
  const { sortedGroups: sortedMyGroups, refetch: refetchMyGroups } = useAllGroupMetrics(myGroups);
  const { sortedGroups: sortedPublicGroups, refetch: refetchPublicGroups } = useAllGroupMetrics(publicGroups);
  const [isResorting, setIsResorting] = useState(false);

  const handleResort = async () => {
    setIsResorting(true);
    try {
      await Promise.all([refetchMyGroups(), refetchPublicGroups()]);
      toast({ title: 'Groups re-sorted', description: 'Groups are now ordered by current scores.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to re-sort groups.' });
    }
    setIsResorting(false);
  };

  // Calculate "All Properties" metrics
  const allPropertiesMetrics = useMemo(() => {
    let totalReviews = 0;
    let totalPoints = 0;

    for (const property of properties) {
      const { avgScore, totalReviews: propReviews } = calculatePropertyMetrics(scores[property.id]);
      if (avgScore !== null && propReviews > 0) {
        totalPoints += avgScore * propReviews;
        totalReviews += propReviews;
      }
    }

    return {
      avgScore: totalReviews > 0 ? totalPoints / totalReviews : null,
      totalReviews,
      totalProperties: properties.length,
    };
  }, [properties, scores]);

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
      await createGroup.mutateAsync({ name, isPublic: newGroupPublic });
      toast({ title: 'Group created', description: `${name} has been created.` });
      setIsCreateOpen(false);
      setNewGroupPublic(false);
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
              Organize properties into groups for comparison (public by default, can make private)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleResort}
              disabled={isResorting}
              title="Re-sort groups by current scores"
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', isResorting && 'animate-spin')} />
              Re-sort
            </Button>
            {properties.length > 0 && (
              <Button 
                variant="outline" 
                onClick={() => setIsAutoGroupOpen(true)}
              >
                <Wand2 className="mr-2 h-4 w-4" />
                Auto-Group
              </Button>
            )}
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
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="is_public"
                      checked={newGroupPublic}
                      onCheckedChange={(checked) => setNewGroupPublic(checked === true)}
                    />
                    <Label htmlFor="is_public" className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span>Make this group public</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Public groups can be viewed by other users
                      </p>
                    </Label>
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
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span>Loading groups...</span>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* All Properties Card */}
            <Card 
              className="shadow-kasa transition-all hover:shadow-kasa-hover border-2 border-dashed border-accent/30 cursor-pointer"
              onClick={() => navigate('/dashboard')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                  <Globe className="h-5 w-5 text-accent" />
                  All Properties
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="mb-5 flex items-center justify-center rounded-xl bg-muted/50 py-4 cursor-help">
                        {allPropertiesMetrics.avgScore !== null ? (
                          <div className="text-center">
                            <div className={cn('text-4xl font-bold', getScoreColor(allPropertiesMetrics.avgScore))}>
                              {formatScore(allPropertiesMetrics.avgScore)}
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
                      <p className="font-semibold">Portfolio Weighted Average</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Combined score across all properties
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">{allPropertiesMetrics.totalProperties}</div>
                      <p className="text-xs text-muted-foreground">
                        {allPropertiesMetrics.totalProperties === 1 ? 'property' : 'properties'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">{allPropertiesMetrics.totalReviews.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">reviews</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 text-xs text-muted-foreground text-center">
                  Click to view dashboard
                </div>
              </CardContent>
            </Card>

            {sortedMyGroups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                onDelete={() => handleDelete(group.id, group.name)}
                onManage={() => setSelectedGroupId(group.id)}
                isSelected={selectedGroupId === group.id}
                isOwner={true}
              />
            ))}
          </div>
        )}

        {/* Public Groups Section */}
        {publicGroups.length > 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Public Groups</h2>
              <p className="mt-1 text-muted-foreground">
                Shared groups from other users (read-only)
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {sortedPublicGroups.map(group => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onDelete={() => {}}
                  onManage={() => {}}
                  isSelected={false}
                  isOwner={false}
                  onCopy={async (name) => {
                    try {
                      await copyGroup.mutateAsync({ sourceGroupId: group.id, newName: name });
                      toast({ title: 'Group copied', description: `"${name}" has been added to your groups.` });
                    } catch (error) {
                      toast({ variant: 'destructive', title: 'Error', description: 'Failed to copy group.' });
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {selectedGroupId && (
          <GroupPropertiesManager
            groupId={selectedGroupId}
            allProperties={properties}
            onClose={() => setSelectedGroupId(null)}
          />
        )}

        <AutoGroupDialog
          open={isAutoGroupOpen}
          onOpenChange={setIsAutoGroupOpen}
          properties={properties}
          scores={scores}
        />
      </div>
    </DashboardLayout>
  );
}

function GroupCard({
  group,
  onDelete,
  onManage,
  isSelected,
  isOwner = true,
  onCopy,
}: {
  group: { id: string; name: string; created_at: string; is_public?: boolean; user_id?: string };
  onDelete: () => void;
  onManage: () => void;
  isSelected: boolean;
  isOwner?: boolean;
  onCopy?: (name: string) => void;
}) {
  const navigate = useNavigate();
  const { avgScore, totalProperties, totalReviews, isLoading, properties, scores } = useGroupMetrics(group.id);
  const { updateGroup } = useGroups();
  const { toast } = useToast();
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(group.name);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [copyName, setCopyName] = useState(`${group.name} (Copy)`);

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('[role="menuitem"]')) {
      return;
    }
    navigate(`/dashboard?group=${group.id}`);
  };

  const handleRename = async () => {
    if (!newName.trim() || newName === group.name) {
      setIsRenaming(false);
      return;
    }
    try {
      await updateGroup.mutateAsync({ id: group.id, name: newName.trim() });
      toast({ title: 'Group renamed', description: `Group renamed to "${newName.trim()}"` });
      setIsRenaming(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to rename group.' });
    }
  };

  const handleTogglePublic = async () => {
    try {
      await updateGroup.mutateAsync({ id: group.id, isPublic: !group.is_public });
      toast({ 
        title: group.is_public ? 'Group made private' : 'Group made public',
        description: group.is_public 
          ? 'Only you can see this group now.' 
          : 'Other users can now view this group.'
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update group.' });
    }
  };

  const handleExport = () => {
    exportGroupToCSV(group.name, properties, scores as Record<string, Record<ReviewSource, { score: number; count: number; updated: string }>>);
    toast({ title: 'Export complete', description: 'Group exported to CSV.' });
  };

  const handleCopy = () => {
    if (onCopy && copyName.trim()) {
      onCopy(copyName.trim());
      setIsCopyDialogOpen(false);
    }
  };

  const isPrivate = !group.is_public;

  return (
    <>
      <Card 
        className={cn(
          'shadow-kasa transition-all hover:shadow-kasa-hover cursor-pointer',
          isSelected && 'ring-2 ring-accent',
          isPrivate && 'bg-muted/60'
        )}
        onClick={handleCardClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          {isRenaming ? (
            <div className="flex items-center gap-2 flex-1 mr-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') setIsRenaming(false);
                }}
              />
              <Button size="sm" variant="ghost" onClick={handleRename}>Save</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <GroupBadge groupName={group.name} />
              <CardTitle className="text-xl font-semibold">{group.name}</CardTitle>
              {group.is_public ? (
                <span className="flex items-center gap-1 text-xs text-accent">
                  <Globe className="h-3.5 w-3.5" />
                  Public
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  Private
                </span>
              )}
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isOwner && (
                <>
                  <DropdownMenuItem onClick={() => setIsAnalysisOpen(true)}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze Reviews
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onManage}>
                    <Settings className="mr-2 h-4 w-4" />
                    Manage Properties
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setNewName(group.name); setIsRenaming(true); }}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleTogglePublic}>
                    {group.is_public ? (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Make Private
                      </>
                    ) : (
                      <>
                        <Globe className="mr-2 h-4 w-4" />
                        Make Public
                      </>
                    )}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={handleExport} disabled={totalProperties === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </DropdownMenuItem>
              {!isOwner && onCopy && (
                <DropdownMenuItem onClick={() => setIsCopyDialogOpen(true)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy to My Groups
                </DropdownMenuItem>
              )}
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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

      <GroupAnalysisDialog
        open={isAnalysisOpen}
        onOpenChange={setIsAnalysisOpen}
        groupId={group.id}
        groupName={group.name}
      />

      {/* Copy Group Dialog */}
      <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copy Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="copy-name">New Group Name</Label>
              <Input
                id="copy-name"
                value={copyName}
                onChange={(e) => setCopyName(e.target.value)}
                placeholder="Enter a name for your copy"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              This will create a copy of the group with only the properties you own.
            </p>
            <Button onClick={handleCopy} className="w-full">
              <Copy className="mr-2 h-4 w-4" />
              Copy Group
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
