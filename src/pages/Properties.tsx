import { useState } from 'react';
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
  TableCell,
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
import { Plus, Trash2, Building2, MapPin, RefreshCw, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Property, ReviewSource } from '@/lib/types';
import { getScoreColor } from '@/lib/scoring';
import { PlatformScoreCell } from '@/components/properties/PlatformScoreCell';
import { AllPlatformsRefreshDialog } from '@/components/properties/AllPlatformsRefreshDialog';

export default function Properties() {
  const { user, loading } = useAuth();
  const { properties, isLoading, createProperty, deleteProperty } = useProperties();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAllPlatformsDialogOpen, setIsAllPlatformsDialogOpen] = useState(false);
  const [refreshingPropertyId, setRefreshingPropertyId] = useState<string | null>(null);
  const [refreshingSource, setRefreshingSource] = useState<string | null>(null);
  
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
  
  const [refreshingPlatform, setRefreshingPlatform] = useState<ReviewSource | null>(null);

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

  const handleRefreshSinglePlatform = async (platform: ReviewSource) => {
    if (refreshingPlatform) return;
    setRefreshingPlatform(platform);
    
    for (const property of properties) {
      try {
        if (platform === 'google') {
          await fetchGoogleRating.mutateAsync({ property });
        } else {
          await fetchOTARating.mutateAsync({ property, source: platform });
        }
      } catch (error) {
        // Continue with next property even if one fails
        console.error(`Failed to refresh ${platform} for ${property.name}:`, error);
      }
    }
    
    setRefreshingPlatform(null);
    toast({
      title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} refresh complete`,
      description: `Updated ${properties.length} properties`,
    });
  };

  const getScore = (propertyId: string, source: ReviewSource) => {
    return scores[propertyId]?.[source];
  };

  const calculateWeightedAverage = (propertyId: string) => {
    const platforms: ReviewSource[] = ['google', 'tripadvisor', 'booking', 'expedia'];
    let totalPoints = 0;
    let totalReviews = 0;

    for (const platform of platforms) {
      const data = scores[propertyId]?.[platform];
      if (data && data.score > 0 && data.count > 0) {
        totalPoints += data.score * data.count;
        totalReviews += data.count;
      }
    }

    if (totalReviews === 0) return null;
    return totalPoints / totalReviews;
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
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Location</TableHead>
                  <TableHead className="text-center font-semibold">Weighted Avg</TableHead>
                  <TableHead className="text-center font-semibold">
                    <div className="flex flex-col items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-amber-500 hover:bg-amber-500/10"
                        onClick={() => handleRefreshSinglePlatform('google')}
                        disabled={!!refreshingPlatform || isAllPlatformsRunning}
                      >
                        <RefreshCw className={cn('h-3 w-3', refreshingPlatform === 'google' && 'animate-spin')} />
                      </Button>
                      <span className="text-amber-500">Google</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    <div className="flex flex-col items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-orange-500 hover:bg-orange-500/10"
                        onClick={() => handleRefreshSinglePlatform('tripadvisor')}
                        disabled={!!refreshingPlatform || isAllPlatformsRunning}
                      >
                        <RefreshCw className={cn('h-3 w-3', refreshingPlatform === 'tripadvisor' && 'animate-spin')} />
                      </Button>
                      <span className="text-orange-500">TripAdvisor</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    <div className="flex flex-col items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-blue-500 hover:bg-blue-500/10"
                        onClick={() => handleRefreshSinglePlatform('booking')}
                        disabled={!!refreshingPlatform || isAllPlatformsRunning}
                      >
                        <RefreshCw className={cn('h-3 w-3', refreshingPlatform === 'booking' && 'animate-spin')} />
                      </Button>
                      <span className="text-blue-500">Booking</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    <div className="flex flex-col items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-purple-500 hover:bg-purple-500/10"
                        onClick={() => handleRefreshSinglePlatform('expedia')}
                        disabled={!!refreshingPlatform || isAllPlatformsRunning}
                      >
                        <RefreshCw className={cn('h-3 w-3', refreshingPlatform === 'expedia' && 'animate-spin')} />
                      </Button>
                      <span className="text-purple-500">Expedia</span>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold">Last Updated</TableHead>
                  <TableHead className="w-[280px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefreshAllPlatforms}
                      disabled={isAllPlatformsRunning || properties.length === 0}
                      className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {isAllPlatformsRunning ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          Refreshing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3.5 w-3.5" />
                          Refresh All Platforms
                        </>
                      )}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map(property => {
                  const googleScore = getScore(property.id, 'google');
                  const tripAdvisorScore = getScore(property.id, 'tripadvisor');
                  const bookingScore = getScore(property.id, 'booking');
                  const expediaScore = getScore(property.id, 'expedia');
                  const weightedAvg = calculateWeightedAverage(property.id);
                  const isRefreshingThis = refreshingPropertyId === property.id;
                  
                  // Find most recent update across all platforms
                  const allUpdates = [googleScore, tripAdvisorScore, bookingScore, expediaScore]
                    .filter(Boolean)
                    .map(s => s!.updated);
                  const mostRecentUpdate = allUpdates.length > 0
                    ? allUpdates.reduce((a, b) => new Date(a) > new Date(b) ? a : b)
                    : null;
                  
                  return (
                    <TableRow key={property.id} className="group">
                      <TableCell className="font-medium">{property.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {property.city}, {property.state}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {weightedAvg !== null ? (
                          <span className={cn('text-lg font-bold', getScoreColor(weightedAvg))}>
                            {weightedAvg.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <PlatformScoreCell data={googleScore} platform="google" />
                      </TableCell>
                      <TableCell className="text-center">
                        <PlatformScoreCell data={tripAdvisorScore} platform="tripadvisor" />
                      </TableCell>
                      <TableCell className="text-center">
                        <PlatformScoreCell data={bookingScore} platform="booking" />
                      </TableCell>
                      <TableCell className="text-center">
                        <PlatformScoreCell data={expediaScore} platform="expedia" />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {mostRecentUpdate
                          ? format(new Date(mostRecentUpdate), 'MMM d, h:mm a')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {/* Google refresh */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-amber-600 hover:bg-amber-500/10 hover:text-amber-600"
                            onClick={() => handleRefreshGoogle(property)}
                            disabled={isRefreshingThis}
                          >
                            {isRefreshingThis && refreshingSource === 'google' ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              'G'
                            )}
                          </Button>
                          
                          {/* TripAdvisor refresh */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-orange-600 hover:bg-orange-500/10 hover:text-orange-600"
                            onClick={() => handleRefreshOTA(property, 'tripadvisor')}
                            disabled={isRefreshingThis}
                          >
                            {isRefreshingThis && refreshingSource === 'tripadvisor' ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              'TA'
                            )}
                          </Button>
                          
                          {/* Booking refresh */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-500/10 hover:text-blue-600"
                            onClick={() => handleRefreshOTA(property, 'booking')}
                            disabled={isRefreshingThis}
                          >
                            {isRefreshingThis && refreshingSource === 'booking' ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              'B'
                            )}
                          </Button>
                          
                          {/* Expedia refresh */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-purple-600 hover:bg-purple-500/10 hover:text-purple-600"
                            onClick={() => handleRefreshOTA(property, 'expedia')}
                            disabled={isRefreshingThis}
                          >
                            {isRefreshingThis && refreshingSource === 'expedia' ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              'E'
                            )}
                          </Button>
                          
                          {/* Delete button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            onClick={() => handleDelete(property.id, property.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
