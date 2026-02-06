import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProperties } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import { normalizeHotelName } from '@/lib/hotelNameUtils';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Search, Loader2, Check, AlertCircle, Building2, Link2, Star, RefreshCw, ExternalLink, Hotel, Home } from 'lucide-react';
import { ReviewSource } from '@/lib/types';

interface DiscoveredProperty {
  url: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  type: 'hotel' | 'apartment' | 'unknown';
  rating: number | null;
  reviewCount: number | null;
  selected: boolean;
  matchedPropertyId?: string;
  matchedPropertyName?: string;
}

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
    reviewerName?: string;
    date?: string;
  }>;
  platformBreakdown: Record<string, number>;
}

interface ImportResult {
  slug: string;
  success: boolean;
  error?: string;
  propertyId?: string;
  propertyName?: string;
  isNew: boolean;
  rating?: number | null;
  reviewCount?: number;
}

export default function Kasa() {
  const { user, loading } = useAuth();
  const { properties } = useProperties();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'idle' | 'discovering' | 'selecting' | 'importing' | 'complete'>('idle');
  const [discoveredProperties, setDiscoveredProperties] = useState<DiscoveredProperty[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [currentImport, setCurrentImport] = useState<string | null>(null);

  // Filter properties that have Kasa data
  const kasaProperties = useMemo(() => {
    return properties.filter(p => p.kasa_url || p.kasa_aggregated_score);
  }, [properties]);

  const handleDiscover = async () => {
    setStep('discovering');
    setDiscoveredProperties([]);

    try {
      const { data, error } = await supabase.functions.invoke('discover-kasa-properties');

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Discovery failed');
      }

      // Match discovered properties to existing ones
      const matched: DiscoveredProperty[] = data.properties.map((prop: { 
        url: string; 
        slug: string; 
        name: string;
        city?: string;
        state?: string;
        type?: 'hotel' | 'apartment' | 'unknown';
        rating?: number | null;
        reviewCount?: number | null;
      }) => {
        const normalizedDiscoveredName = normalizeHotelName(prop.name);
        
        let matchedProperty = null;
        for (const existing of properties) {
          const normalizedExistingName = normalizeHotelName(existing.name);
          
          if (normalizedDiscoveredName.includes(normalizedExistingName) || 
              normalizedExistingName.includes(normalizedDiscoveredName) ||
              normalizedDiscoveredName === normalizedExistingName) {
            matchedProperty = existing;
            break;
          }
          
          if (prop.name.toLowerCase().includes(existing.city.toLowerCase())) {
            const words = normalizedDiscoveredName.split(' ');
            const existingWords = normalizedExistingName.split(' ');
            const commonWords = words.filter(w => existingWords.includes(w) && w.length > 3);
            if (commonWords.length >= 2) {
              matchedProperty = existing;
              break;
            }
          }
        }

        return {
          ...prop,
          city: prop.city || '',
          state: prop.state || '',
          type: prop.type || 'unknown',
          rating: prop.rating ?? null,
          reviewCount: prop.reviewCount ?? null,
          selected: true,
          matchedPropertyId: matchedProperty?.id,
          matchedPropertyName: matchedProperty?.name,
        };
      });

      setDiscoveredProperties(matched);
      setStep('selecting');

      if (matched.length === 0) {
        toast({
          title: 'No properties found',
          description: 'Could not find any Kasa properties. The website structure may have changed.',
        });
        setStep('idle');
      }
    } catch (error) {
      console.error('Discovery error:', error);
      toast({
        variant: 'destructive',
        title: 'Discovery failed',
        description: error instanceof Error ? error.message : 'Failed to discover properties',
      });
      setStep('idle');
    }
  };

  const toggleProperty = (slug: string) => {
    setDiscoveredProperties(prev => prev.map(p => 
      p.slug === slug ? { ...p, selected: !p.selected } : p
    ));
  };

  const selectAll = () => {
    setDiscoveredProperties(prev => prev.map(p => ({ ...p, selected: true })));
  };

  const deselectAll = () => {
    setDiscoveredProperties(prev => prev.map(p => ({ ...p, selected: false })));
  };

  const handleImport = async () => {
    const selectedProps = discoveredProperties.filter(p => p.selected);
    if (selectedProps.length === 0) {
      toast({ variant: 'destructive', title: 'No properties selected' });
      return;
    }

    setStep('importing');
    setImportProgress(0);
    setImportResults([]);

    const results: ImportResult[] = [];

    for (let i = 0; i < selectedProps.length; i++) {
      const prop = selectedProps[i];
      setCurrentImport(prop.name);
      setImportProgress(Math.round((i / selectedProps.length) * 100));

      try {
        const { data: propData, error: propError } = await supabase.functions.invoke('fetch-kasa-property', {
          body: { url: prop.url, slug: prop.slug },
        });

        if (propError || !propData?.success) {
          throw new Error(propData?.error || propError?.message || 'Failed to fetch property data');
        }

        const propertyInfo: ImportedPropertyData = propData.property;
        let propertyId = prop.matchedPropertyId;
        let propertyName = prop.matchedPropertyName;
        let isNew = false;

        if (!propertyId) {
          const { data: newProp, error: createError } = await supabase
            .from('properties')
            .insert({
              name: propertyInfo.name || prop.name,
              city: propertyInfo.city || 'Unknown',
              state: propertyInfo.state || '',
              user_id: user!.id,
              kasa_aggregated_score: propertyInfo.aggregatedRating,
              kasa_review_count: propertyInfo.reviewCount,
              kasa_url: propertyInfo.url,
            })
            .select()
            .single();

          if (createError) throw createError;
          propertyId = newProp.id;
          propertyName = newProp.name;
          isNew = true;
        } else {
          await supabase
            .from('properties')
            .update({
              kasa_aggregated_score: propertyInfo.aggregatedRating,
              kasa_review_count: propertyInfo.reviewCount,
              kasa_url: propertyInfo.url,
            })
            .eq('id', propertyId);
        }

        if (propertyInfo.reviews && propertyInfo.reviews.length > 0) {
          const reviewsByPlatform: Record<string, typeof propertyInfo.reviews> = {};
          propertyInfo.reviews.forEach(review => {
            const platform = review.platform;
            if (['google', 'tripadvisor', 'booking', 'expedia'].includes(platform)) {
              if (!reviewsByPlatform[platform]) reviewsByPlatform[platform] = [];
              reviewsByPlatform[platform].push(review);
            }
          });

          for (const [platform, reviews] of Object.entries(reviewsByPlatform)) {
            const reviewInserts = reviews.map(review => ({
              property_id: propertyId,
              platform: platform as ReviewSource,
              review_text: review.text,
              review_rating: review.rating,
              reviewer_name: review.reviewerName || null,
              review_date: review.date || null,
            }));

            if (reviewInserts.length > 0) {
              await supabase.from('review_texts').insert(reviewInserts);
            }
          }
        }

        results.push({
          slug: prop.slug,
          success: true,
          propertyId,
          propertyName,
          isNew,
          rating: propertyInfo.aggregatedRating,
          reviewCount: propertyInfo.reviewCount,
        });

      } catch (error) {
        console.error('Import error for', prop.name, error);
        results.push({
          slug: prop.slug,
          success: false,
          error: error instanceof Error ? error.message : 'Import failed',
          propertyName: prop.name,
          isNew: false,
        });
      }

      setImportResults([...results]);
      // Longer delay (2s) between requests to avoid Firecrawl rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    setImportProgress(100);
    setCurrentImport(null);
    setStep('complete');

    queryClient.invalidateQueries({ queryKey: ['properties'] });
    queryClient.invalidateQueries({ queryKey: ['hotel-aliases'] });
    queryClient.invalidateQueries({ queryKey: ['source-snapshots'] });

    const successCount = results.filter(r => r.success).length;
    const newCount = results.filter(r => r.isNew).length;
    
    toast({
      title: 'Import complete',
      description: `${successCount}/${results.length} properties imported (${newCount} new)`,
    });
  };

  const resetImport = () => {
    setStep('idle');
    setDiscoveredProperties([]);
    setImportProgress(0);
    setImportResults([]);
  };

  const selectedCount = discoveredProperties.filter(p => p.selected).length;

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
      <div className="space-y-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Kasa Properties</h1>
            <p className="mt-2 text-muted-foreground">
              Import and manage properties from Kasa.com with aggregated ratings
            </p>
          </div>

          <Button 
            onClick={handleDiscover} 
            disabled={step === 'discovering' || step === 'importing'}
          >
            {step === 'discovering' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Discovering...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Discover Properties
              </>
            )}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Kasa Properties</CardDescription>
              <CardTitle className="text-3xl">{kasaProperties.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Properties with Kasa data imported
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg. Kasa Score</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                {kasaProperties.length > 0 ? (
                  <>
                    <Star className="h-6 w-6 fill-primary text-primary" />
                    {(kasaProperties.reduce((acc, p) => acc + (Number(p.kasa_aggregated_score) || 0), 0) / kasaProperties.filter(p => p.kasa_aggregated_score).length || 0).toFixed(2)}
                  </>
                ) : (
                  '—'
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Average aggregated rating from Kasa.com
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Reviews</CardDescription>
              <CardTitle className="text-3xl">
                {kasaProperties.reduce((acc, p) => acc + (p.kasa_review_count || 0), 0).toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Combined reviews across all platforms
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Import Flow */}
        {step === 'selecting' && (
          <Card>
            <CardHeader>
              <CardTitle>Select Properties to Import</CardTitle>
              <CardDescription>
                Found {discoveredProperties.length} properties • {selectedCount} selected
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Deselect All
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <ScrollArea className="h-[450px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Property Name</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead className="text-center">Rating</TableHead>
                        <TableHead className="text-center">Type</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discoveredProperties.map(prop => (
                        <TableRow 
                          key={prop.slug}
                          className={`cursor-pointer ${prop.selected ? 'bg-primary/5' : ''}`}
                          onClick={() => toggleProperty(prop.slug)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={prop.selected}
                              onCheckedChange={() => toggleProperty(prop.slug)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell className="font-medium max-w-[250px]">
                            <span className="truncate block">{prop.name}</span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {prop.city || '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {prop.state || '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            {prop.rating ? (
                              <div className="flex items-center justify-center gap-1">
                                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                                <span className="font-medium">{prop.rating.toFixed(1)}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {prop.type === 'hotel' ? (
                              <Badge variant="secondary" className="gap-1">
                                <Hotel className="h-3 w-3" />
                                Hotel
                              </Badge>
                            ) : prop.type === 'apartment' ? (
                              <Badge variant="outline" className="gap-1">
                                <Home className="h-3 w-3" />
                                Apt
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {prop.matchedPropertyId ? (
                              <Badge variant="secondary" className="shrink-0">
                                <Link2 className="h-3 w-3 mr-1" />
                                Matched
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="shrink-0">
                                New
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetImport}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={selectedCount === 0}>
                  Import {selectedCount} {selectedCount === 1 ? 'Property' : 'Properties'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'importing' && (
          <Card>
            <CardHeader>
              <CardTitle>Importing Properties</CardTitle>
              <CardDescription>
                Please wait while we import your properties...
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Importing {importResults.length + 1}/{discoveredProperties.filter(p => p.selected).length}...
                  </span>
                  <span className="font-medium">{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
              
              {currentImport && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="truncate">{currentImport}</span>
                </div>
              )}

              {importResults.length > 0 && (
                <ScrollArea className="h-40 border rounded-lg">
                  <div className="p-2 space-y-1">
                    {importResults.map(result => (
                      <div
                        key={result.slug}
                        className={`flex items-center gap-2 p-2 rounded text-sm ${
                          result.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                        }`}
                      >
                        {result.success ? (
                          <Check className="h-4 w-4 shrink-0" />
                        ) : (
                          <AlertCircle className="h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate flex-1">
                          {result.propertyName}
                          {result.isNew && <span className="text-muted-foreground"> (new)</span>}
                        </span>
                        {result.rating && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Star className="h-3 w-3 fill-current" />
                            {result.rating.toFixed(2)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'complete' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle>Import Complete</CardTitle>
                  <CardDescription>
                    {importResults.filter(r => r.success).length} of {importResults.length} properties imported
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-48 border rounded-lg">
                <div className="p-2 space-y-1">
                  {importResults.map(result => (
                    <div
                      key={result.slug}
                      className={`flex items-center gap-2 p-2 rounded text-sm ${
                        result.success ? '' : 'text-destructive'
                      }`}
                    >
                      {result.success ? (
                        <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span className="truncate flex-1">{result.propertyName}</span>
                      {result.isNew && (
                        <Badge variant="outline" className="shrink-0">New</Badge>
                      )}
                      {result.success && !result.isNew && (
                        <Badge variant="secondary" className="shrink-0">Updated</Badge>
                      )}
                      {result.rating && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Star className="h-3 w-3 fill-current" />
                          {result.rating.toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-end">
                <Button onClick={resetImport}>Done</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Kasa Properties Table */}
        {kasaProperties.length > 0 && step === 'idle' && (
          <Card>
            <CardHeader>
              <CardTitle>Imported Kasa Properties</CardTitle>
              <CardDescription>
                Properties with Kasa aggregated ratings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-center">Kasa Score</TableHead>
                    <TableHead className="text-center">Reviews</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kasaProperties.map(property => (
                    <TableRow key={property.id}>
                      <TableCell className="font-medium">{property.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {property.city}, {property.state}
                      </TableCell>
                      <TableCell className="text-center">
                        {property.kasa_aggregated_score ? (
                          <div className="flex items-center justify-center gap-1">
                            <Star className="h-4 w-4 fill-primary text-primary" />
                            <span className="font-semibold">
                              {Number(property.kasa_aggregated_score).toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {property.kasa_review_count?.toLocaleString() || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {property.kasa_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a
                              href={property.kasa_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {kasaProperties.length === 0 && step === 'idle' && (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-6 text-xl font-semibold">No Kasa Properties Yet</h3>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                Click "Discover Properties" to find and import all Kasa properties with their aggregated ratings and review data.
              </p>
              <Button onClick={handleDiscover} className="mt-6">
                <Search className="mr-2 h-4 w-4" />
                Discover Properties
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
