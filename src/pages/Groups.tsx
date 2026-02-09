import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
  Globe, Sparkles, Copy, Lock, Loader2, LayoutGrid, TableIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getScoreColor, formatScore, calculatePropertyMetrics } from '@/lib/scoring';
import { SortableTableHead, SortDirection } from '@/components/properties/SortableTableHead';
import { cn } from '@/lib/utils';
import { AutoGroupDialog } from '@/components/groups/AutoGroupDialog';
import { GroupAnalysisDialog } from '@/components/groups/GroupAnalysisDialog';
import { GroupBadge } from '@/components/groups/GroupBadge';
import { ReviewSource } from '@/lib/types';
import { exportGroupToCSV } from '@/lib/csv';
import { supabase } from '@/integrations/supabase/client';

export default function Groups() {
  const { user, loading } = useAuth();
  const { myGroups, publicGroups, isLoading, createGroup, deleteGroup, updateGroup, copyGroup } = useGroups();
  const { properties } = useProperties();
  const propertyIds = properties.map(p => p.id);
  const { data: scores = {} } = useLatestPropertyScores(propertyIds);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAutoGroupOpen, setIsAutoGroupOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [newGroupPublic, setNewGroupPublic] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiFiltering, setIsAiFiltering] = useState(false);

  // Get sorted groups by score
  const { sortedGroups: sortedMyGroups, refetch: refetchMyGroups } = useAllGroupMetrics(myGroups);
  const { sortedGroups: sortedPublicGroups, refetch: refetchPublicGroups } = useAllGroupMetrics(publicGroups);
  const [isResorting, setIsResorting] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = useCallback((key: string) => {
    if (sortColumn === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
      if (sortDirection === 'desc') setSortColumn(null);
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  }, [sortColumn, sortDirection]);

  const applySorting = useCallback(<T extends { name: string; created_at: string; is_public?: boolean }>(groups: T[]): T[] => {
    if (!sortColumn || !sortDirection) return groups;
    
    return [...groups].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'visibility':
          cmp = (a.is_public ? 1 : 0) - (b.is_public ? 1 : 0);
          break;
        case 'created':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        default:
          return 0; // score/properties/reviews handled by useAllGroupMetrics
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });
  }, [sortColumn, sortDirection]);

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

    setIsAiFiltering(true);
    try {
      // Create group
      const group = await createGroup.mutateAsync({ name, isPublic: newGroupPublic, description: aiPrompt.trim() || undefined });

      // If AI prompt provided, use it to filter and add properties
      if (aiPrompt.trim()) {
        try {

          const response = await supabase.functions.invoke('smart-group-filter', {
            body: { prompt: aiPrompt.trim() },
          });

          if (response.data?.propertyIds?.length > 0) {
            await supabase
              .from('group_properties')
              .insert(response.data.propertyIds.map((pid: string) => ({
                group_id: group.id,
                property_id: pid,
              })));

            queryClient.invalidateQueries({ queryKey: ['group-properties'] });

            toast({
              title: 'Group created',
              description: `${name} created with ${response.data.propertyIds.length} properties.`,
            });
          } else {
            toast({
              title: 'Group created',
              description: `${name} created. No properties matched your prompt — add them manually.`,
            });
          }
        } catch (aiError) {
          console.error('AI filter error:', aiError);
          toast({
            title: 'Group created',
            description: `${name} created but AI filtering failed. Add properties manually.`,
          });
        }
      } else {
        toast({ title: 'Group created', description: `${name} has been created.` });
      }

      setIsCreateOpen(false);
      setNewGroupPublic(true);
      setAiPrompt('');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create group.' });
    }
    setIsAiFiltering(false);
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
                  <div className="space-y-2">
                    <Label htmlFor="ai_prompt">
                      <div className="flex items-center gap-2">
                        <Wand2 className="h-4 w-4 text-accent" />
                        <span>AI Property Filter</span>
                        <span className="text-xs text-muted-foreground">(optional)</span>
                      </div>
                    </Label>
                    <Textarea
                      id="ai_prompt"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder='e.g., "All competitors in California with avg score above 8" or "Hotels in NYC and Boston"'
                      className="min-h-[72px] resize-none rounded-md text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Describe which properties to include. Leave blank to add manually.
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="is_private"
                      checked={!newGroupPublic}
                      onCheckedChange={(checked) => setNewGroupPublic(checked !== true)}
                    />
                    <Label htmlFor="is_private" className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <span>Make this group private</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Private groups are only visible to you
                      </p>
                    </Label>
                  </div>
                  <Button 
                    type="submit" 
                    variant="secondary"
                    className="h-12 w-full" 
                    disabled={createGroup.isPending || isAiFiltering}
                  >
                    {isAiFiltering ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        AI filtering properties...
                      </>
                    ) : createGroup.isPending ? 'Creating...' : 'Create Group'}
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
          <div className="space-y-4">
            {/* View Toggle */}
            <div className="flex items-center">
              <ToggleGroup 
                type="single" 
                value={viewMode} 
                onValueChange={(v) => v && setViewMode(v as 'card' | 'table')}
                className="bg-muted p-1 rounded-lg"
              >
                <ToggleGroupItem value="card" aria-label="Card view" className="data-[state=on]:bg-background data-[state=on]:text-foreground text-muted-foreground">
                  <LayoutGrid className="h-4 w-4 mr-1.5" />
                  Cards
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Table view" className="data-[state=on]:bg-background data-[state=on]:text-foreground text-muted-foreground">
                  <TableIcon className="h-4 w-4 mr-1.5" />
                  Table
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {viewMode === 'card' ? (
              <GroupCardSections
                allPropertiesMetrics={allPropertiesMetrics}
                sortedMyGroups={sortedMyGroups}
                selectedGroupId={selectedGroupId}
                onDelete={handleDelete}
                onManage={(id) => setSelectedGroupId(id)}
                onNavigateDashboard={() => navigate('/dashboard')}
              />
            ) : (
              /* Table View */
              <Card className="shadow-kasa">
              <div className="rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <SortableTableHead sortKey="name" currentSort={sortColumn} currentDirection={sortDirection} onSort={handleSort} className="font-semibold text-left">Group Name</SortableTableHead>
                      <SortableTableHead sortKey="score" currentSort={sortColumn} currentDirection={sortDirection} onSort={handleSort} className="font-semibold text-center">Weighted Avg</SortableTableHead>
                      <SortableTableHead sortKey="properties" currentSort={sortColumn} currentDirection={sortDirection} onSort={handleSort} className="font-semibold text-center">Properties</SortableTableHead>
                      <SortableTableHead sortKey="reviews" currentSort={sortColumn} currentDirection={sortDirection} onSort={handleSort} className="font-semibold text-center">Reviews</SortableTableHead>
                      <SortableTableHead sortKey="visibility" currentSort={sortColumn} currentDirection={sortDirection} onSort={handleSort} className="font-semibold">Visibility</SortableTableHead>
                      <SortableTableHead sortKey="created" currentSort={sortColumn} currentDirection={sortDirection} onSort={handleSort} className="font-semibold">Created</SortableTableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* All Properties Row */}
                    <TableRow 
                      className="cursor-pointer hover:bg-muted/30 border-b-2 border-dashed border-accent/20"
                      onClick={() => navigate('/dashboard')}
                    >
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-accent" />
                          All Properties
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn('font-bold', getScoreColor(allPropertiesMetrics.avgScore))}>
                          {allPropertiesMetrics.avgScore !== null ? formatScore(allPropertiesMetrics.avgScore) : '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-medium">{allPropertiesMetrics.totalProperties}</TableCell>
                      <TableCell className="text-center font-medium">{allPropertiesMetrics.totalReviews.toLocaleString()}</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell />
                    </TableRow>
                    {applySorting(sortedMyGroups).map(group => (
                      <GroupTableRow
                        key={group.id}
                        group={group}
                        onDelete={() => handleDelete(group.id, group.name)}
                        onManage={() => setSelectedGroupId(group.id)}
                        isOwner={true}
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              </Card>
            )}
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
            {viewMode === 'card' ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            ) : (
              <Card className="shadow-kasa">
              <div className="rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <SortableTableHead sortKey="name" currentSort={sortColumn} currentDirection={sortDirection} onSort={handleSort} className="font-semibold text-left">Group Name</SortableTableHead>
                      <SortableTableHead sortKey="score" currentSort={sortColumn} currentDirection={sortDirection} onSort={handleSort} className="font-semibold text-center">Weighted Avg</SortableTableHead>
                      <SortableTableHead sortKey="properties" currentSort={sortColumn} currentDirection={sortDirection} onSort={handleSort} className="font-semibold text-center">Properties</SortableTableHead>
                      <SortableTableHead sortKey="reviews" currentSort={sortColumn} currentDirection={sortDirection} onSort={handleSort} className="font-semibold text-center">Reviews</SortableTableHead>
                      <SortableTableHead sortKey="created" currentSort={sortColumn} currentDirection={sortDirection} onSort={handleSort} className="font-semibold">Created</SortableTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applySorting(sortedPublicGroups).map(group => (
                      <GroupTableRow
                        key={group.id}
                        group={group}
                        onDelete={() => {}}
                        onManage={() => {}}
                        isOwner={false}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              </Card>
            )}
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
const STATE_PATTERN = /^[A-Z]{2}_Comp Set$/;
const SCORE_TIER_NAMES = ['Wonderful (9.0+)', 'Very Good (8.0-8.99)', 'Good (7.0-7.99)', 'Pleasant (6.0-6.99)', 'Needs Work (0-5.99)'];

function getGroupTooltip(name: string, description?: string | null): string {
  const lower = name.toLowerCase();
  if (name === 'Comp Set') return 'All competitor properties (excludes Kasa)';
  if (name === 'Kasa Only') return 'All Kasa-branded properties';
  if (lower === 'other') return 'Properties not assigned to other portfolio groups';
  if (lower.includes('all') || lower.includes('portfolio')) return 'All properties across the full portfolio';
  if (name === 'Wonderful (9.0+)') return 'Properties with weighted avg score ≥ 9.0';
  if (name === 'Very Good (8.0-8.99)') return 'Properties with weighted avg score 8.0–8.99';
  if (name === 'Good (7.0-7.99)') return 'Properties with weighted avg score 7.0–7.99';
  if (name === 'Pleasant (6.0-6.99)') return 'Properties with weighted avg score 6.0–6.99';
  if (name === 'Needs Work (0-5.99)') return 'Properties with weighted avg score below 6.0';
  if (STATE_PATTERN.test(name)) {
    const stateCode = name.split('_')[0];
    return `Competitor properties located in ${stateCode}`;
  }
  if (description) return `AI filter: "${description}"`;
  return 'Custom group — manually curated';
}

function GroupCardSections({
  allPropertiesMetrics,
  sortedMyGroups,
  selectedGroupId,
  onDelete,
  onManage,
  onNavigateDashboard,
}: {
  allPropertiesMetrics: { avgScore: number | null; totalReviews: number; totalProperties: number };
  sortedMyGroups: Array<{ id: string; name: string; created_at: string; is_public?: boolean; user_id?: string }>;
  selectedGroupId: string | null;
  onDelete: (id: string, name: string) => void;
  onManage: (id: string) => void;
  onNavigateDashboard: () => void;
}) {
  const { portfolioGroups, scoreGroups, stateGroups, customGroups } = useMemo(() => {
    const portfolio: typeof sortedMyGroups = [];
    const score: typeof sortedMyGroups = [];
    const state: typeof sortedMyGroups = [];
    const custom: typeof sortedMyGroups = [];

    const portfolioExactNames = ['comp set', 'kasa only', 'other'];
    const portfolioContains = ['all properties', 'portfolio'];

    for (const g of sortedMyGroups) {
      const nameLower = g.name.toLowerCase();
      if (SCORE_TIER_NAMES.includes(g.name)) {
        score.push(g);
      } else if (STATE_PATTERN.test(g.name)) {
        state.push(g);
      } else if (
        portfolioExactNames.includes(nameLower) ||
        portfolioContains.some(k => nameLower.includes(k))
      ) {
        portfolio.push(g);
      } else {
        custom.push(g);
      }
    }

    // Sort state groups alphabetically
    state.sort((a, b) => a.name.localeCompare(b.name));

    return { portfolioGroups: portfolio, scoreGroups: score, stateGroups: state, customGroups: custom };
  }, [sortedMyGroups]);

  const gridClass = "grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";

  const renderCards = (groups: typeof sortedMyGroups) =>
    groups.map(group => (
      <GroupCard
        key={group.id}
        group={group}
        onDelete={() => onDelete(group.id, group.name)}
        onManage={() => onManage(group.id)}
        isSelected={selectedGroupId === group.id}
        isOwner={true}
      />
    ));

  return (
    <div className="space-y-6">
      {/* Portfolio section */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Portfolio</h3>
        <div className={gridClass}>
          <TooltipProvider delayDuration={400}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Card
                  className="shadow-kasa transition-all hover:shadow-kasa-hover border-2 border-dashed border-accent/30 cursor-pointer"
                  onClick={onNavigateDashboard}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
                    <CardTitle className="flex items-center gap-1.5 text-xs font-semibold">
                      <Globe className="h-3 w-3 text-accent" />
                      All Properties
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 pt-0">
                    <div className="mb-2 flex items-center justify-center rounded-md bg-muted/50 py-2">
                      {allPropertiesMetrics.avgScore !== null ? (
                        <div className="text-center">
                          <div className={cn('text-xl font-bold', getScoreColor(allPropertiesMetrics.avgScore))}>
                            {formatScore(allPropertiesMetrics.avgScore)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xl font-bold text-muted-foreground">—</div>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span><span className="font-semibold text-foreground">{allPropertiesMetrics.totalProperties}</span> props</span>
                      <span><span className="font-semibold text-foreground">{allPropertiesMetrics.totalReviews.toLocaleString()}</span> reviews</span>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-xs">
                All properties across the full portfolio
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {renderCards(portfolioGroups)}
        </div>
      </div>

      {/* By Score section */}
      {scoreGroups.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">By Score</h3>
          <p className="text-[11px] text-muted-foreground mb-2">All properties sorted into score bands via Auto-Group</p>
          <div className={gridClass}>
            {renderCards(scoreGroups)}
          </div>
        </div>
      )}

      {/* By State section */}
      {stateGroups.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">By State</h3>
          <div className={gridClass}>
            {renderCards(stateGroups)}
          </div>
        </div>
      )}

      {/* By Custom Search section */}
      {customGroups.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">By Custom Search</h3>
          <div className={gridClass}>
            {renderCards(customGroups)}
          </div>
        </div>
      )}

    </div>
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
  group: { id: string; name: string; created_at: string; is_public?: boolean; user_id?: string; description?: string | null };
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
  const queryClient = useQueryClient();
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(group.name);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [copyName, setCopyName] = useState(`${group.name} (Copy)`);
  const [isRefiltering, setIsRefiltering] = useState(false);

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

  const handleRefilter = async () => {
    if (!group.description) return;
    setIsRefiltering(true);
    try {
      const response = await supabase.functions.invoke('smart-group-filter', {
        body: { prompt: group.description },
      });

      if (response.error) throw response.error;

      // Clear existing properties
      await supabase.from('group_properties').delete().eq('group_id', group.id);

      // Add new matches
      const matchedIds = response.data?.propertyIds || [];
      if (matchedIds.length > 0) {
        await supabase.from('group_properties').insert(
          matchedIds.map((pid: string) => ({ group_id: group.id, property_id: pid }))
        );
      }

      queryClient.invalidateQueries({ queryKey: ['group-properties'] });
      queryClient.invalidateQueries({ queryKey: ['group-metrics'] });
      toast({
        title: 'Group re-filtered',
        description: `Found ${matchedIds.length} properties matching "${group.description}"`,
      });
    } catch (error) {
      console.error('Re-filter error:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to re-filter group.' });
    } finally {
      setIsRefiltering(false);
    }
  };

  const handleCopy = () => {
    if (onCopy && copyName.trim()) {
      onCopy(copyName.trim());
      setIsCopyDialogOpen(false);
    }
  };

  const isPrivate = !group.is_public;

  const tooltipText = getGroupTooltip(group.name, group.description);

  return (
    <>
      <TooltipProvider delayDuration={400}>
        <Tooltip>
          <TooltipTrigger asChild>
      <Card 
        className={cn(
          'shadow-kasa transition-all hover:shadow-kasa-hover cursor-pointer',
          isSelected && 'ring-2 ring-accent',
          isPrivate && 'bg-muted/60'
        )}
        onClick={handleCardClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
          {isRenaming ? (
            <div className="flex items-center gap-1 flex-1 mr-1">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-6 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') setIsRenaming(false);
                }}
              />
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5" onClick={handleRename}>Save</Button>
            </div>
          ) : (
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <GroupBadge groupName={group.name} />
              <CardTitle className="text-xs font-semibold truncate">{group.name}</CardTitle>
              {group.is_public ? (
                <Globe className="h-2.5 w-2.5 text-accent shrink-0" />
              ) : (
                <Lock className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
              )}
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground shrink-0">
                <MoreVertical className="h-3 w-3" />
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
                  {group.description && (
                    <DropdownMenuItem onClick={handleRefilter} disabled={isRefiltering}>
                      {isRefiltering ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Re-filter Properties
                    </DropdownMenuItem>
                  )}
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
        <CardContent className="px-3 pb-3 pt-0">
          {/* Score */}
          <div className="mb-2 flex items-center justify-center rounded-md bg-muted/50 py-2">
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            ) : avgScore !== null ? (
              <div className="text-center">
                <div className={cn('text-xl font-bold', getScoreColor(avgScore))}>
                  {formatScore(avgScore)}
                </div>
              </div>
            ) : (
              <div className="text-xl font-bold text-muted-foreground">—</div>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span><span className="font-semibold text-foreground">{totalProperties}</span> props</span>
            <span><span className="font-semibold text-foreground">{totalReviews.toLocaleString()}</span> reviews</span>
          </div>
        </CardContent>
      </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-xs">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

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

function GroupTableRow({
  group,
  onDelete,
  onManage,
  isOwner = true,
  sortColumn,
  sortDirection,
}: {
  group: { id: string; name: string; created_at: string; is_public?: boolean };
  onDelete: () => void;
  onManage: () => void;
  isOwner?: boolean;
  sortColumn?: string | null;
  sortDirection?: SortDirection;
}) {
  const navigate = useNavigate();
  const { avgScore, totalProperties, totalReviews, isLoading } = useGroupMetrics(group.id);
  const { updateGroup } = useGroups();
  const { toast } = useToast();

  const handleToggleVisibility = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newPublic = !group.is_public;
    try {
      await updateGroup.mutateAsync({ id: group.id, isPublic: newPublic });
      toast({ title: `Group ${newPublic ? 'made public' : 'made private'}` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update visibility.' });
    }
  };

  return (
    <TableRow 
      className="cursor-pointer hover:bg-muted/30"
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('[role="menuitem"]')) return;
        navigate(`/dashboard?group=${group.id}`);
      }}
    >
      <TableCell className="font-semibold">
        <div className="flex items-center gap-2">
          <GroupBadge groupName={group.name} />
          {group.name}
        </div>
      </TableCell>
      <TableCell className="text-center">
        {isLoading ? (
          <div className="flex justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : (
          <span className={cn('font-bold', getScoreColor(avgScore))}>
            {avgScore !== null ? formatScore(avgScore) : '—'}
          </span>
        )}
      </TableCell>
      <TableCell className="text-center font-medium">{totalProperties}</TableCell>
      <TableCell className="text-center font-medium">{totalReviews.toLocaleString()}</TableCell>
      <TableCell>
        {isOwner ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleToggleVisibility}
          >
            {group.is_public ? (
              <span className="flex items-center gap-1 text-accent">
                <Globe className="h-3.5 w-3.5" />
                Public
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                Private
              </span>
            )}
          </Button>
        ) : (
          <span className="flex items-center gap-1 text-xs text-accent">
            <Globe className="h-3.5 w-3.5" />
            Public
          </span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {format(new Date(group.created_at), 'MMM d, yyyy')}
      </TableCell>
      <TableCell>
        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onManage}>
                <Settings className="mr-2 h-4 w-4" />
                Manage Properties
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
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
