import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProperties } from '@/hooks/useProperties';
import { useLatestPropertyScores } from '@/hooks/useSnapshots';
import { useGoogleRatings, getGoogleRatingErrorMessage } from '@/hooks/useGoogleRatings';
import { useOTARatings, getOTARatingErrorMessage, OTASource } from '@/hooks/useOTARatings';
import { useAllPlatformsRefresh } from '@/hooks/useAllPlatformsRefresh';
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
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Plus, Building2, RefreshCw, Download } from 'lucide-react';
import googleLogo from '@/assets/logos/google.svg';
import tripadvisorLogo from '@/assets/logos/tripadvisor.png';
import bookingLogo from '@/assets/logos/booking.png';
import expediaLogo from '@/assets/logos/expedia.png';
import { useToast } from '@/hooks/use-toast';
import { Property, ReviewSource } from '@/lib/types';
import { PropertyRow } from '@/components/properties/PropertyRow';
import { AllPlatformsRefreshDialog } from '@/components/properties/AllPlatformsRefreshDialog';
import { exportPropertiesToCSV } from '@/lib/csv';
import { calculatePropertyMetrics } from '@/lib/scoring';
import { SortableTableHead, SortDirection } from '@/components/properties/SortableTableHead';

type SortKey = 'name' | 'location' | 'avgScore' | 'totalReviews' | 'google' | 'tripadvisor' | 'booking' | 'expedia' | null;

export default function Properties() {
  const { user, loading } = useAuth();
  const { properties, isLoading, createProperty, deleteProperty } = useProperties();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAllPlatformsDialogOpen, setIsAllPlatformsDialogOpen] = useState(false);
  const [refreshingPropertyId, setRefreshingPropertyId] = useState<string | null>(null);
  const [refreshingSource, setRefreshingSource] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  
  const propertyIds = properties.map(p => p.id);
  const { data: scores = {} } = useLatestPropertyScores(propertyIds);
  const { fetchGoogleRating } = useGoogleRatings();
  const { fetchOTARating } = useOTARatings();
  const {
    isRunning: isAllPlatformsRunning,
    isComplete: isAllPlatformsComplete,
    currentPlatform,
    propertyStates,
    startAllPlatformsRefresh,
    retryPlatform,
    setDialogOpen: setAllPlatformsDialogOpen,
  } = useAllPlatformsRefresh();

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

  const sortedProperties = useMemo(() => {
    if (!sortKey || !sortDirection) return properties;

    return [...properties].sort((a, b) => {
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
  }, [properties, scores, sortKey, sortDirection]);

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
    const city = formData.get('city') as string;
    const state = formData.get('state') as string;

    try {
      await createProperty.mutateAsync({ name, city, state });
      toast({ title: 'Property created', description: `${name} has been added.` });
      setIsDialogOpen(false);
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

  const handleRefreshGoogle = async (property: Property) => {
    setRefreshingPropertyId(property.id);
    setRefreshingSource('google');
    
    try {
      const result = await fetchGoogleRating.mutateAsync({ property });
      toast({
        title: 'Google rating updated',
        description: `${property.name}: ${result.rating?.toFixed(1) || 'N/A'} ★`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'API_ERROR';
      toast({
        variant: 'destructive',
        title: 'Refresh failed',
        description: getGoogleRatingErrorMessage(errorMessage),
      });
    } finally {
      setRefreshingPropertyId(null);
      setRefreshingSource(null);
    }
  };

  const handleRefreshOTA = async (property: Property, source: OTASource) => {
    setRefreshingPropertyId(property.id);
    setRefreshingSource(source);
    
    try {
      const result = await fetchOTARating.mutateAsync({ property, source });
      toast({
        title: `${source.charAt(0).toUpperCase() + source.slice(1)} rating updated`,
        description: `${property.name}: ${result.rating?.toFixed(1) || 'N/A'}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'API_ERROR';
      toast({
        variant: 'destructive',
        title: 'Refresh failed',
        description: getOTARatingErrorMessage(errorMessage, source),
      });
    } finally {
      setRefreshingPropertyId(null);
      setRefreshingSource(null);
    }
  };

  const handleRefreshAllPlatforms = () => {
    setIsAllPlatformsDialogOpen(true);
    setAllPlatformsDialogOpen(true);
    startAllPlatformsRefresh(properties);
  };

  const handleAllPlatformsDialogChange = (open: boolean) => {
    setIsAllPlatformsDialogOpen(open);
    setAllPlatformsDialogOpen(open);
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
            {properties.length > 0 && (
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
                  onClick={handleRefreshAllPlatforms}
                  disabled={isAllPlatformsRunning}
                >
                  {isAllPlatformsRunning ? (
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
                    <Input 
                      id="name" 
                      name="name" 
                      placeholder="The Grand Hotel" 
                      className="h-12 rounded-md"
                      required 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input 
                        id="city" 
                        name="city" 
                        placeholder="New York" 
                        className="h-12 rounded-md"
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input 
                        id="state" 
                        name="state" 
                        placeholder="NY" 
                        className="h-12 rounded-md"
                        required 
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    variant="secondary"
                    className="h-12 w-full" 
                    disabled={createProperty.isPending}
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
        ) : properties.length === 0 ? (
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
                    className="font-semibold"
                  >
                    Avg Score
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="totalReviews"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="font-semibold"
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
                    <div className="flex flex-col items-center gap-1">
                      <img src={googleLogo} alt="Google" className="h-4 w-4" />
                      <span className="text-blue-500">Google</span>
                    </div>
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="tripadvisor"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="font-semibold"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <img src={tripadvisorLogo} alt="TripAdvisor" className="h-4 w-auto max-w-[60px] mix-blend-multiply" />
                      <span className="text-green-600">TripAdvisor</span>
                    </div>
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="booking"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="font-semibold"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <img src={bookingLogo} alt="Booking" className="h-4 w-auto mix-blend-multiply" />
                      <span className="text-blue-800">Booking</span>
                    </div>
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="expedia"
                    currentSort={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="font-semibold"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <img src={expediaLogo} alt="Expedia" className="h-4 w-4 mix-blend-multiply" />
                      <span className="text-yellow-500">Expedia</span>
                    </div>
                  </SortableTableHead>
                  <TableHead className="w-40"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProperties.map(property => (
                  <PropertyRow
                    key={property.id}
                    property={property}
                    scores={scores[property.id]}
                    onDelete={handleDelete}
                    onRefreshGoogle={handleRefreshGoogle}
                    onRefreshOTA={handleRefreshOTA}
                    isRefreshing={refreshingPropertyId === property.id}
                    refreshingSource={refreshingSource}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* All platforms refresh dialog */}
        <AllPlatformsRefreshDialog
          open={isAllPlatformsDialogOpen}
          onOpenChange={handleAllPlatformsDialogChange}
          propertyStates={propertyStates}
          currentPlatform={currentPlatform}
          onRetry={retryPlatform}
          isComplete={isAllPlatformsComplete}
        />
      </div>
    </DashboardLayout>
  );
}
