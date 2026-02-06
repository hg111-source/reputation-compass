import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProperties } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import { normalizeHotelName } from '@/lib/hotelNameUtils';
import { 
  useLatestKasaSnapshots, 
  calculateWeightedAverage,
  useBatchSaveKasaSnapshots 
} from '@/hooks/useKasaSnapshots';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Search, Loader2, Star, ExternalLink, TrendingUp } from 'lucide-react';
import { ReviewSource } from '@/lib/types';

interface ImportedPropertyData {
  name: string;
  url: string;
  slug: string;
  city: string;
  state: string;
  aggregatedRating: number | null;
  reviewCount: number;
  reviews: Array<{
    text: string;
    rating: number | null;
    platform: string;
  }>;
}

export default function Kasa() {
  const { user, loading } = useAuth();
  const { properties } = useProperties();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const batchSaveSnapshots = useBatchSaveKasaSnapshots();

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [currentProperty, setCurrentProperty] = useState<string | null>(null);

  // Filter properties that have Kasa data
  const kasaProperties = useMemo(() => {
    return properties.filter(p => p.kasa_url || p.kasa_aggregated_score);
  }, [properties]);

  const kasaPropertyIds = useMemo(() => kasaProperties.map(p => p.id), [kasaProperties]);
  
  // Fetch latest Kasa snapshots for weighted average calculation
  const { data: kasaSnapshots = {} } = useLatestKasaSnapshots(kasaPropertyIds);
  
  // Calculate weighted portfolio stats from snapshots
  const portfolioStats = useMemo(() => {
    return calculateWeightedAverage(kasaSnapshots);
  }, [kasaSnapshots]);

  // Fallback to properties table if no snapshots exist yet
  const displayStats = useMemo(() => {
    if (portfolioStats.totalReviews > 0) {
      return {
        avgScore: portfolioStats.weightedAverage !== null 
          ? portfolioStats.weightedAverage / 2 // Convert back to 5-scale for display
          : null,
        totalReviews: portfolioStats.totalReviews,
        source: 'snapshots' as const,
      };
    }
    
    // Fallback: Calculate from properties table (weighted)
    const withScores = kasaProperties.filter(p => p.kasa_aggregated_score && p.kasa_review_count);
    if (withScores.length === 0) {
      return { avgScore: null, totalReviews: 0, source: 'properties' as const };
    }
    
    let weightedSum = 0;
    let totalReviews = 0;
    for (const p of withScores) {
      const score = Number(p.kasa_aggregated_score) || 0;
      const count = p.kasa_review_count || 0;
      weightedSum += score * count;
      totalReviews += count;
    }
    
    return {
      avgScore: totalReviews > 0 ? weightedSum / totalReviews : null,
      totalReviews,
      source: 'properties' as const,
    };
  }, [portfolioStats, kasaProperties]);

  const handleImportFromKasa = async () => {
    setIsImporting(true);
    setImportProgress(0);

    try {
      // Step 1: Discover properties
      setCurrentProperty('Discovering properties...');
      const { data: discoverData, error: discoverError } = await supabase.functions.invoke('discover-kasa-properties');

      if (discoverError || !discoverData?.success) {
        throw new Error(discoverData?.error || discoverError?.message || 'Discovery failed');
      }

      const discoveredProperties = discoverData.properties || [];
      if (discoveredProperties.length === 0) {
        toast({ title: 'No properties found', description: 'Could not find any Kasa properties.' });
        setIsImporting(false);
        return;
      }

      toast({ title: `Found ${discoveredProperties.length} properties`, description: 'Starting import...' });

      // Collect snapshots to batch insert
      const snapshotsToSave: Array<{
        propertyId: string;
        rating: number | null;
        reviewCount: number;
      }> = [];

      // Step 2: Import each property
      let successCount = 0;
      let newCount = 0;

      for (let i = 0; i < discoveredProperties.length; i++) {
        const prop = discoveredProperties[i];
        setCurrentProperty(prop.name);
        setImportProgress(Math.round(((i + 1) / discoveredProperties.length) * 100));

        try {
          const { data: propData, error: propError } = await supabase.functions.invoke('fetch-kasa-property', {
            body: { url: prop.url, slug: prop.slug },
          });

          if (propError || !propData?.success) {
            console.error('Failed to fetch', prop.name, propData?.error || propError?.message);
            continue;
          }

          const propertyInfo: ImportedPropertyData = propData.property;

          // Try to match to existing property - first by URL, then by name
          let matchedProperty = properties.find(existing => 
            existing.kasa_url === propertyInfo.url || existing.kasa_url === prop.url
          );
          
          if (!matchedProperty) {
            const normalizedName = normalizeHotelName(prop.name);
            const normalizedInfoName = normalizeHotelName(propertyInfo.name || '');
            matchedProperty = properties.find(existing => {
              const normalizedExisting = normalizeHotelName(existing.name);
              return normalizedName.includes(normalizedExisting) || 
                     normalizedExisting.includes(normalizedName) ||
                     normalizedName === normalizedExisting ||
                     normalizedInfoName.includes(normalizedExisting) ||
                     normalizedExisting.includes(normalizedInfoName);
            });
          }

          if (matchedProperty) {
            // Update existing property
            await supabase
              .from('properties')
              .update({
                kasa_aggregated_score: propertyInfo.aggregatedRating,
                kasa_review_count: propertyInfo.reviewCount,
                kasa_url: propertyInfo.url,
                city: propertyInfo.city || matchedProperty.city,
                state: propertyInfo.state || matchedProperty.state,
              })
              .eq('id', matchedProperty.id);
              
            // Queue snapshot for batch insert
            snapshotsToSave.push({
              propertyId: matchedProperty.id,
              rating: propertyInfo.aggregatedRating,
              reviewCount: propertyInfo.reviewCount,
            });
          } else {
            // Create new property
            const { data: newProp, error: createError } = await supabase
              .from('properties')
              .insert({
                name: propertyInfo.name || prop.name,
                city: propertyInfo.city || prop.city || 'Unknown',
                state: propertyInfo.state || prop.state || '',
                user_id: user!.id,
                kasa_aggregated_score: propertyInfo.aggregatedRating,
                kasa_review_count: propertyInfo.reviewCount,
                kasa_url: propertyInfo.url,
              })
              .select()
              .single();

            if (!createError && newProp) {
              matchedProperty = newProp;
              newCount++;
              
              // Queue snapshot for new property
              snapshotsToSave.push({
                propertyId: newProp.id,
                rating: propertyInfo.aggregatedRating,
                reviewCount: propertyInfo.reviewCount,
              });
            }
          }

          // Save reviews if we have a property
          if (matchedProperty && propertyInfo.reviews?.length > 0) {
            const validReviews = propertyInfo.reviews.filter(r => 
              ['google', 'tripadvisor', 'booking', 'expedia'].includes(r.platform)
            );

            if (validReviews.length > 0) {
              const reviewInserts = validReviews.map(review => ({
                property_id: matchedProperty!.id,
                platform: review.platform as ReviewSource,
                review_text: review.text,
                review_rating: review.rating,
              }));

              await supabase.from('review_texts').insert(reviewInserts);
            }
          }

          successCount++;
        } catch (error) {
          console.error('Error importing', prop.name, error);
        }

        // Delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Batch save all snapshots
      if (snapshotsToSave.length > 0) {
        try {
          await batchSaveSnapshots.mutateAsync(snapshotsToSave);
          console.log(`Saved ${snapshotsToSave.length} Kasa snapshots`);
        } catch (err) {
          console.error('Failed to save snapshots:', err);
        }
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['kasa-snapshots'] });

      toast({
        title: 'Import complete',
        description: `${successCount}/${discoveredProperties.length} properties imported (${newCount} new), ${snapshotsToSave.length} snapshots saved`,
      });

    } catch (error) {
      console.error('Import error:', error);
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import properties',
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setCurrentProperty(null);
    }
  };

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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Kasa Properties</h1>
            <p className="mt-2 text-muted-foreground">
              Properties imported from Kasa.com with aggregated ratings
            </p>
          </div>

          <Button onClick={handleImportFromKasa} disabled={isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Import from Kasa.com
              </>
            )}
          </Button>
        </div>

        {/* Import Progress */}
        {isImporting && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate max-w-md">
                    {currentProperty}
                  </span>
                  <span className="font-medium">{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Row */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Properties</CardDescription>
              <CardTitle className="text-3xl">{kasaProperties.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                Weighted Average
                <TrendingUp className="h-3 w-3" />
              </CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                {displayStats.avgScore !== null ? (
                  <>
                    <Star className="h-6 w-6 fill-primary text-primary" />
                    {displayStats.avgScore.toFixed(2)}/5
                  </>
                ) : (
                  '—'
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                Based on {displayStats.totalReviews.toLocaleString()} reviews
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Reviews</CardDescription>
              <CardTitle className="text-3xl">
                {displayStats.totalReviews.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Properties Table */}
        <Card>
          <CardHeader>
            <CardTitle>Kasa Properties</CardTitle>
            <CardDescription>
              {kasaProperties.length} properties with Kasa ratings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kasaProperties.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No Kasa properties imported yet.</p>
                <p className="text-sm mt-1">Click "Import from Kasa.com" to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Reviews</TableHead>
                    <TableHead className="text-right">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kasaProperties.map(property => {
                    const snapshot = kasaSnapshots[property.id];
                    const score = snapshot?.score_raw ?? property.kasa_aggregated_score;
                    const reviewCount = snapshot?.review_count ?? property.kasa_review_count;
                    
                    return (
                      <TableRow key={property.id}>
                        <TableCell className="font-medium">{property.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {property.city}{property.state ? `, ${property.state}` : ''}
                        </TableCell>
                        <TableCell className="text-center">
                          {score ? (
                            <div className="flex items-center justify-center gap-1">
                              <Star className="h-4 w-4 fill-primary text-primary" />
                              <span className="font-medium">{Number(score).toFixed(2)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {reviewCount ? (
                            <span className="font-medium">{reviewCount.toLocaleString()}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {property.kasa_url && (
                            <a
                              href={property.kasa_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
