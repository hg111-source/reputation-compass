import { useState, useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProperties } from '@/hooks/useProperties';
import { useLatestPropertyScores } from '@/hooks/useSnapshots';
import { useUnifiedRefresh, Platform } from '@/hooks/useUnifiedRefresh';
import { useGroups } from '@/hooks/useGroups';
import { useAutoHeal } from '@/hooks/useAutoHeal';
import { useBulkInsights } from '@/hooks/useBulkInsights';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Plus, Building2, RefreshCw, Download, LayoutGrid, TableIcon, Home, Bug, Brain } from 'lucide-react';
import googleLogo from '@/assets/logos/google.svg';
import tripadvisorLogo from '@/assets/logos/tripadvisor.png';
import bookingLogo from '@/assets/logos/booking.png';
import expediaLogo from '@/assets/logos/expedia.png';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Property, ReviewSource } from '@/lib/types';
import { PropertyRow } from '@/components/properties/PropertyRow';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { UnifiedRefreshDialog } from '@/components/properties/UnifiedRefreshDialog';
import { PropertyHistoryDialog } from '@/components/properties/PropertyHistoryDialog';
import { ReviewInsightsDialog } from '@/components/properties/ReviewInsightsDialog';
import { exportPropertiesToCSV } from '@/lib/csv';
import { calculatePropertyMetrics } from '@/lib/scoring';
import { SortableTableHead, SortDirection } from '@/components/properties/SortableTableHead';
import { ScoreLegend } from '@/components/properties/ScoreLegend';
import { HotelAutocomplete } from '@/components/properties/HotelAutocomplete';
import { AirbnbDiscoveryDialog } from '@/components/properties/AirbnbDiscoveryDialog';
import { BulkInsightsDialog } from '@/components/properties/BulkInsightsDialog';
import { Progress } from '@/components/ui/progress';

type SortKey = 'name' | 'location' | 'avgScore' | 'totalReviews' | 'google' | 'tripadvisor' | 'booking' | 'expedia' | null;
type ViewMode = 'table' | 'card';

export default function Properties() {
  const { user, loading } = useAuth();
  const { properties, isLoading, createProperty, deleteProperty } = useProperties();
  const { groups } = useGroups();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const showDebug = searchParams.get('debug') === 'true';
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRefreshDialogOpen, setIsRefreshDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [historyProperty, setHistoryProperty] = useState<Property | null>(null);
  const [insightsProperty, setInsightsProperty] = useState<Property | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [isAirbnbDiscoveryOpen, setIsAirbnbDiscoveryOpen] = useState(false);
  const [isBulkInsightsOpen, setIsBulkInsightsOpen] = useState(false);
  const bulkInsights = useBulkInsights();
  
  // Form state for controlled inputs
  const [formName, setFormName] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formPlaceId, setFormPlaceId] = useState<string | null>(null);
  const [formWebsiteUrl, setFormWebsiteUrl] = useState<string | null>(null);
  
  const propertyIds = properties.map(p => p.id);
  const { data: scores = {} } = useLatestPropertyScores(propertyIds);

  // Track which properties have fetched review data
  const { data: propertiesWithReviews = new Set<string>() } = useQuery({
    queryKey: ['properties-with-reviews', user?.id],
    queryFn: async () => {
      if (!user || propertyIds.length === 0) return new Set<string>();
      const { data, error } = await supabase
        .from('review_texts')
        .select('property_id')
        .in('property_id', propertyIds);
      if (error) throw error;
      return new Set(data?.map(r => r.property_id) || []);
    },
    enabled: !!user && propertyIds.length > 0,
  });
  
  // Auto-heal: detect and recover missing scores on page load
  const nonKasaPropertiesForHeal = useMemo(() => {
    return properties.filter(p => !p.kasa_url && !p.kasa_aggregated_score);
  }, [properties]);
  const { isHealing, progress: healProgress, getItemStatus } = useAutoHeal(
    nonKasaPropertiesForHeal,
    scores,
    !isLoading && nonKasaPropertiesForHeal.length > 0
  );

  // Fetch property-to-group mappings (property_id -> group_ids)
  const { data: propertyGroupIds = {} } = useQuery({
    queryKey: ['property-groups-ids', user?.id],
    queryFn: async () => {
      if (!user) return {};
      const { data, error } = await supabase
        .from('group_properties')
        .select('property_id, group_id');
      if (error) throw error;
      
      // Build a map of property_id -> array of group_ids
      const mapping: Record<string, string[]> = {};
      data?.forEach((gp: any) => {
        const propId = gp.property_id;
        const groupId = gp.group_id;
        if (groupId) {
          if (!mapping[propId]) mapping[propId] = [];
          if (!mapping[propId].includes(groupId)) {
            mapping[propId].push(groupId);
          }
        }
      });
      return mapping;
    },
    enabled: !!user,
  });

  // Calculate property count per group
  const groupPropertyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(propertyGroupIds).forEach((groupIds) => {
      groupIds.forEach((groupId) => {
        counts[groupId] = (counts[groupId] || 0) + 1;
      });
    });
    return counts;
  }, [propertyGroupIds]);
  
  // Unified refresh hook - handles URL resolution + fetching in one flow
  const {
    isRunning,
    isComplete,
    currentPhase,
    currentPlatform,
    propertyStates,
    refreshSingleCell,
    refreshSingleRow,
    refreshAll,
    retryPlatform,
    retryAllFailed,
    getFailedCount,
    setDialogOpen,
  } = useUnifiedRefresh();

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(key as SortKey);
      setSortDirection('desc');
    }
  };

  // Filter out Kasa-only properties (they have their own page)
  const nonKasaProperties = useMemo(() => {
    return properties.filter(p => !p.kasa_url && !p.kasa_aggregated_score);
  }, [properties]);

  // Filter properties by selected group
  const filteredProperties = useMemo(() => {
    if (selectedGroupFilter === 'all') return nonKasaProperties;
    return nonKasaProperties.filter(p => propertyGroupIds[p.id]?.includes(selectedGroupFilter));
  }, [nonKasaProperties, propertyGroupIds, selectedGroupFilter]);

  const sortedProperties = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredProperties;

    return [...filteredProperties].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortKey) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'location':
          aVal = `${a.city}, ${a.state}`.toLowerCase();
          bVal = `${b.city}, ${b.state}`.toLowerCase();
          break;
        case 'avgScore':
          const aMetrics = calculatePropertyMetrics(scores[a.id]);
          const bMetrics = calculatePropertyMetrics(scores[b.id]);
          aVal = aMetrics.avgScore ?? -1;
          bVal = bMetrics.avgScore ?? -1;
          break;
        case 'totalReviews':
          const aTotal = calculatePropertyMetrics(scores[a.id]);
          const bTotal = calculatePropertyMetrics(scores[b.id]);
          aVal = aTotal.totalReviews;
          bVal = bTotal.totalReviews;
          break;
        case 'google':
        case 'tripadvisor':
        case 'booking':
        case 'expedia':
          aVal = scores[a.id]?.[sortKey]?.score ?? -1;
          bVal = scores[b.id]?.[sortKey]?.score ?? -1;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filteredProperties, scores, sortKey, sortDirection]);

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

    if (!formName.trim() || !formCity.trim() || !formState.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill in all fields.' });
      return;
    }

    try {
      const newProperty = await createProperty.mutateAsync({ 
        name: formName.trim(), 
        city: formCity.trim(), 
        state: formState.trim(),
        google_place_id: formPlaceId,
        website_url: formWebsiteUrl,
      });
      toast({ title: 'Property created', description: `${formName} has been added. Fetching ratings...` });
      setIsDialogOpen(false);
      
      // Reset form
      setFormName('');
      setFormCity('');
      setFormState('');
      setFormPlaceId(null);
      setFormWebsiteUrl(null);
      
      // Auto-refresh all platforms for the new property using unified flow
      setIsRefreshDialogOpen(true);
      setDialogOpen(true);
      refreshSingleRow(newProperty);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create property.' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteProperty.mutateAsync(id);
      toast({ title: 'Property deleted', description: `${name} has been removed.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete property.' });
    }
  };

  // UNIFIED: Single cell refresh (one platform, one hotel)
  const handleRefreshSingleCell = async (property: Property, platform: Platform) => {
    setIsRefreshDialogOpen(true);
    setDialogOpen(true);
    refreshSingleCell(property, platform);
  };

  // UNIFIED: Single row refresh (all platforms, one hotel)
  const handleRefreshSingleRow = (property: Property) => {
    setIsRefreshDialogOpen(true);
    setDialogOpen(true);
    refreshSingleRow(property);
  };

  // UNIFIED: Refresh all (all platforms, all hotels)
  const handleRefreshAll = () => {
    setIsRefreshDialogOpen(true);
    setDialogOpen(true);
    refreshAll(nonKasaProperties);
  };

  // UNIFIED: Refresh single platform column
  const handleRefreshColumn = (platform: Platform) => {
    setIsRefreshDialogOpen(true);
    setDialogOpen(true);
    refreshAll(nonKasaProperties, [platform]);
  };

  // Refresh only properties with pending aliases on specific platforms
  const handleRefreshPending = async (platforms: Platform[] = ['booking', 'tripadvisor', 'expedia']) => {
    // Query pending aliases
    const { data: pendingAliases } = await supabase
      .from('hotel_aliases')
      .select('property_id, source')
      .eq('resolution_status', 'pending')
      .in('source', platforms);

    if (!pendingAliases || pendingAliases.length === 0) {
      toast({ title: 'Nothing to resolve', description: 'No pending aliases found.' });
      return;
    }

    const pendingPropertyIds = [...new Set(pendingAliases.map(a => a.property_id))];
    const pendingProperties = nonKasaProperties.filter(p => pendingPropertyIds.includes(p.id));
    // Determine which platforms actually have pending entries
    const pendingPlatforms = [...new Set(pendingAliases.map(a => a.source))] as Platform[];

    if (pendingProperties.length === 0) {
      toast({ title: 'Nothing to resolve', description: 'No matching properties found.' });
      return;
    }

    toast({ title: `Resolving ${pendingProperties.length} properties`, description: `Platforms: ${pendingPlatforms.join(', ')}` });
    setIsRefreshDialogOpen(true);
    setDialogOpen(true);
    refreshAll(pendingProperties, pendingPlatforms);
  };

  const handleRefreshDialogChange = (open: boolean) => {
    setIsRefreshDialogOpen(open);
    setDialogOpen(open);
  };

  const handleExportCSV = () => {
    exportPropertiesToCSV(properties, scores);
    toast({ title: 'Export complete', description: 'Properties exported to CSV.' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Properties</h1>
            <p className="mt-2 text-muted-foreground">
              Manage your hotel and property listings
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAirbnbDiscoveryOpen(true)}
            >
              <Home className="mr-2 h-4 w-4" />
              Discover Airbnb
            </Button>
            {nonKasaProperties.length > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleRefreshPending()}
                  disabled={isRunning}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resolve Pending
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRefreshAll}
                  disabled={isRunning}
                >
                  {isRunning ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh All
                    </>
                  )}
                </Button>
              </>
            )}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Property
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-xl sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl">Add Property</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-5 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Hotel Name</Label>
                    <HotelAutocomplete
                      value={formName}
                      onChange={setFormName}
                      onSelect={(details) => {
                        setFormName(details.name);
                        if (details.city) setFormCity(details.city);
                        if (details.state) setFormState(details.state);
                        if (details.placeId) setFormPlaceId(details.placeId);
                        if (details.websiteUrl) setFormWebsiteUrl(details.websiteUrl);
                      }}
                      placeholder="Search for a hotel..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Start typing to search or enter manually
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input 
                        id="city" 
                        value={formCity}
                        onChange={(e) => setFormCity(e.target.value)}
                        placeholder="New York" 
                        className="h-12 rounded-md"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input 
                        id="state" 
                        value={formState}
                        onChange={(e) => setFormState(e.target.value)}
                        placeholder="NY" 
                        className="h-12 rounded-md"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    variant="secondary"
                    className="h-12 w-full" 
                    disabled={createProperty.isPending || !formName.trim()}
                  >
                    {createProperty.isPending ? 'Adding...' : 'Add Property'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span>Loading properties...</span>
          </div>
        ) : nonKasaProperties.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-20 text-center shadow-kasa">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-8 text-2xl font-semibold">No properties yet</h3>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Add properties manually or upload a CSV file to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
          {/* Auto-heal progress bar */}
          {isHealing && healProgress && (
            <Card className="p-4 shadow-kasa">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  Auto-healing: {healProgress.resolved + healProgress.failed}/{healProgress.total} resolved
                </div>
                <span className="text-xs text-muted-foreground">
                  {healProgress.resolved} recovered, {healProgress.failed} unavailable
                </span>
              </div>
              <Progress value={((healProgress.resolved + healProgress.failed) / healProgress.total) * 100} className="h-2" />
            </Card>
          )}
          <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Select value={selectedGroupFilter} onValueChange={setSelectedGroupFilter}>
                  <SelectTrigger className="h-10 w-[220px] rounded-lg border-2 border-primary bg-primary text-primary-foreground font-semibold shadow-kasa hover:bg-primary/90 transition-colors">
                    <SelectValue placeholder="All Properties" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-border bg-card shadow-kasa-hover">
                    <SelectItem value="all">All Properties ({nonKasaProperties.length})</SelectItem>
                    {groups.map(group => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} ({groupPropertyCounts[group.id] || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ToggleGroup 
                  type="single" 
                  value={viewMode} 
                  onValueChange={(v) => v && setViewMode(v as ViewMode)}
                  className="bg-muted p-1 rounded-lg"
                >
                  <ToggleGroupItem value="table" aria-label="Table view" className="data-[state=on]:bg-background data-[state=on]:text-foreground text-muted-foreground">
                    <TableIcon className="h-4 w-4 mr-1.5" />
                    Table
                  </ToggleGroupItem>
                  <ToggleGroupItem value="card" aria-label="Card view" className="data-[state=on]:bg-background data-[state=on]:text-foreground text-muted-foreground">
                    <LayoutGrid className="h-4 w-4 mr-1.5" />
                    Cards
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <ScoreLegend className="ml-auto" />
            </div>
            
            {viewMode === 'table' ? (
              <Card className="overflow-hidden shadow-kasa">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <SortableTableHead
                      sortKey="name"
                      currentSort={sortKey}
                      currentDirection={sortDirection}
                    onSort={handleSort}
                    className="font-semibold text-left"
                  >
                    Hotel Name
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="location"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="font-semibold text-left"
                  >
                    Location
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="avgScore"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="font-semibold text-center"
                  >
                    Average Score
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="totalReviews"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="font-semibold text-center"
                  >
                    Total Reviews
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="google"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="font-semibold"
                  >
                    <div className="relative flex flex-col items-center gap-1">
                      <img src={googleLogo} alt="Google" className="h-4 w-4" />
                      <span className="text-primary">Google</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRefreshColumn('google'); }}
                        disabled={isRunning}
                        className="absolute -right-2 top-0 p-0.5 rounded hover:bg-muted/50"
                        title="Refresh all Google"
                      >
                        <RefreshCw className={`h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground ${isRunning && currentPlatform === 'google' ? 'animate-spin text-muted-foreground' : ''}`} />
                      </button>
                    </div>
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="tripadvisor"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="font-semibold"
                  >
                    <div className="relative flex flex-col items-center gap-1">
                      <img src={tripadvisorLogo} alt="TripAdvisor" className="h-4 w-auto max-w-[60px] mix-blend-multiply" />
                      <span className="text-primary">TripAdvisor</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRefreshColumn('tripadvisor'); }}
                        disabled={isRunning}
                        className="absolute -right-2 top-0 p-0.5 rounded hover:bg-muted/50"
                        title="Refresh all TripAdvisor"
                      >
                        <RefreshCw className={`h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground ${isRunning && currentPlatform === 'tripadvisor' ? 'animate-spin text-muted-foreground' : ''}`} />
                      </button>
                    </div>
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="booking"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="font-semibold"
                  >
                    <div className="relative flex flex-col items-center gap-1">
                      <img src={bookingLogo} alt="Booking" className="h-4 w-auto mix-blend-multiply" />
                      <span className="text-primary">Booking</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRefreshColumn('booking'); }}
                        disabled={isRunning}
                        className="absolute -right-2 top-0 p-0.5 rounded hover:bg-muted/50"
                        title="Refresh all Booking"
                      >
                        <RefreshCw className={`h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground ${isRunning && currentPlatform === 'booking' ? 'animate-spin text-muted-foreground' : ''}`} />
                      </button>
                    </div>
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="expedia"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="font-semibold"
                  >
                    <div className="relative flex flex-col items-center gap-1">
                      <img src={expediaLogo} alt="Expedia" className="h-4 w-4 mix-blend-multiply" />
                      <span className="text-primary">Expedia</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRefreshColumn('expedia'); }}
                        disabled={isRunning}
                        className="absolute -right-2 top-0 p-0.5 rounded hover:bg-muted/50"
                        title="Refresh all Expedia"
                      >
                        <RefreshCw className={`h-3 w-3 text-muted-foreground/50 hover:text-muted-foreground ${isRunning && currentPlatform === 'expedia' ? 'animate-spin text-muted-foreground' : ''}`} />
                      </button>
                    </div>
                  </SortableTableHead>
                  <TableHead className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs font-semibold text-muted-foreground">Insights</span>
                      <button
                        onClick={() => {
                          setIsBulkInsightsOpen(true);
                          bulkInsights.run(sortedProperties);
                        }}
                        disabled={bulkInsights.isRunning}
                        className="p-0.5 rounded hover:bg-muted/50"
                        title="Fetch AI insights for all properties"
                      >
                        <Brain className={cn('h-3.5 w-3.5 text-muted-foreground hover:text-foreground', bulkInsights.isRunning && 'animate-pulse text-accent')} />
                      </button>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProperties.map(property => (
                    <PropertyRow
                      key={property.id}
                      property={property}
                      scores={scores[property.id]}
                      onDelete={handleDelete}
                      onRefreshPlatform={(p, platform) => handleRefreshSingleCell(p, platform as Platform)}
                      onRefreshAllPlatforms={handleRefreshSingleRow}
                      onViewHistory={setHistoryProperty}
                      onAnalyzeReviews={setInsightsProperty}
                      isRefreshing={isRunning}
                      refreshingPropertyId={propertyStates.find(ps => ps.phase === 'fetching' || ps.phase === 'resolving')?.property.id ?? null}
                      currentPlatform={currentPlatform}
                      getHealingStatus={getItemStatus}
                      hasReviewData={propertiesWithReviews.has(property.id)}
                    />
                ))}
              </TableBody>
            </Table>
          </Card>
            ) : (
              /* Card View */
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sortedProperties.map(property => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    scores={scores[property.id]}
                    onDelete={handleDelete}
                    onRefreshAllPlatforms={handleRefreshSingleRow}
                    onViewHistory={setHistoryProperty}
                    onAnalyzeReviews={setInsightsProperty}
                    isRefreshing={isRunning}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Unified refresh dialog */}
        <UnifiedRefreshDialog
          open={isRefreshDialogOpen}
          onOpenChange={handleRefreshDialogChange}
          propertyStates={propertyStates}
          currentPhase={currentPhase}
          currentPlatform={currentPlatform}
          onRetry={retryPlatform}
          onRetryAllFailed={retryAllFailed}
          failedCount={getFailedCount()}
          isComplete={isComplete}
          isRunning={isRunning}
        />

        {/* Property history dialog */}
        <PropertyHistoryDialog
          property={historyProperty}
          open={!!historyProperty}
          onOpenChange={(open) => !open && setHistoryProperty(null)}
        />

        {/* Review insights dialog */}
        <ReviewInsightsDialog
          property={insightsProperty}
          open={!!insightsProperty}
          onOpenChange={(open) => !open && setInsightsProperty(null)}
        />

        {/* Airbnb discovery dialog */}
        <AirbnbDiscoveryDialog
          open={isAirbnbDiscoveryOpen}
          onOpenChange={setIsAirbnbDiscoveryOpen}
        />

        {/* Bulk insights dialog */}
        <BulkInsightsDialog
          open={isBulkInsightsOpen}
          onOpenChange={setIsBulkInsightsOpen}
          isRunning={bulkInsights.isRunning}
          states={bulkInsights.states}
          progress={bulkInsights.progress}
          doneCount={bulkInsights.doneCount}
          errorCount={bulkInsights.errorCount}
          total={bulkInsights.total}
          onCancel={bulkInsights.cancel}
        />

        {/* Debug panel - toggle with ?debug=true in URL */}
        {showDebug && healProgress && (
          <Card className="p-4 shadow-kasa">
            <div className="flex items-center gap-2 mb-3">
              <Bug className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Auto-Heal Debug Panel</h3>
              <span className="text-xs text-muted-foreground ml-auto">
                Total: {healProgress.total} | Resolved: {healProgress.resolved} | Failed: {healProgress.failed}
              </span>
            </div>
            <div className="max-h-60 overflow-y-auto text-xs font-mono space-y-1">
              {healProgress.items.map((item, i) => (
                <div key={i} className={cn(
                  'flex items-center gap-2 px-2 py-1 rounded',
                  item.status === 'resolved' && 'bg-emerald-500/10 text-emerald-700',
                  item.status === 'failed' && 'bg-destructive/10 text-destructive',
                  item.status === 'retrying' && 'bg-primary/10 text-primary',
                  item.status === 'queued' && 'text-muted-foreground',
                )}>
                  <span className="w-48 truncate">{item.propertyName}</span>
                  <span className="w-20">{item.platform}</span>
                  <span className="w-16">{item.status}</span>
                  <span className="w-8">×{item.retryCount}</span>
                  {item.error && <span className="truncate text-destructive">{item.error}</span>}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
