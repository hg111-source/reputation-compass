import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProperties } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import { normalizeHotelName } from '@/lib/hotelNameUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Check, AlertCircle, Building2, Link2, Star } from 'lucide-react';
import { ReviewSource } from '@/lib/types';

interface DiscoveredProperty {
  url: string;
  slug: string;
  name: string;
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

interface KasaImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KasaImportDialog({ open, onOpenChange }: KasaImportDialogProps) {
  const { user } = useAuth();
  const { properties } = useProperties();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'idle' | 'discovering' | 'selecting' | 'importing' | 'complete'>('idle');
  const [discoveredProperties, setDiscoveredProperties] = useState<DiscoveredProperty[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [currentImport, setCurrentImport] = useState<string | null>(null);

  const handleDiscover = async () => {
    setStep('discovering');
    setDiscoveredProperties([]);

    try {
      const { data, error } = await supabase.functions.invoke('discover-kasa-properties');

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Discovery failed');
      }

      // Match discovered properties to existing ones
      const matched: DiscoveredProperty[] = data.properties.map((prop: { url: string; slug: string; name: string }) => {
        const normalizedDiscoveredName = normalizeHotelName(prop.name);
        
        // Find matching property
        let matchedProperty = null;
        for (const existing of properties) {
          const normalizedExistingName = normalizeHotelName(existing.name);
          
          if (normalizedDiscoveredName.includes(normalizedExistingName) || 
              normalizedExistingName.includes(normalizedDiscoveredName) ||
              normalizedDiscoveredName === normalizedExistingName) {
            matchedProperty = existing;
            break;
          }
          
          // Check for city match combined with partial name match
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
        // Fetch detailed property data
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

        // Create new property if no match
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
          // Update existing property with Kasa data
          await supabase
            .from('properties')
            .update({
              kasa_aggregated_score: propertyInfo.aggregatedRating,
              kasa_review_count: propertyInfo.reviewCount,
              kasa_url: propertyInfo.url,
            })
            .eq('id', propertyId);
        }

        // Store reviews by platform
        if (propertyInfo.reviews && propertyInfo.reviews.length > 0) {
          // Group reviews by platform
          const reviewsByPlatform: Record<string, typeof propertyInfo.reviews> = {};
          propertyInfo.reviews.forEach(review => {
            const platform = review.platform;
            if (['google', 'tripadvisor', 'booking', 'expedia'].includes(platform)) {
              if (!reviewsByPlatform[platform]) reviewsByPlatform[platform] = [];
              reviewsByPlatform[platform].push(review);
            }
          });

          // Insert reviews for each platform
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
      
      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setImportProgress(100);
    setCurrentImport(null);
    setStep('complete');

    // Refresh data
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

  const handleClose = () => {
    setStep('idle');
    setDiscoveredProperties([]);
    setImportProgress(0);
    setImportResults([]);
    onOpenChange(false);
  };

  const selectedCount = discoveredProperties.filter(p => p.selected).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Import from Kasa.com
          </DialogTitle>
          <DialogDescription>
            Import all Kasa properties with their aggregated ratings and reviews
          </DialogDescription>
        </DialogHeader>

        {step === 'idle' && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-muted-foreground max-w-sm">
                Automatically discover all Kasa properties from kasa.com and import their aggregated ratings and review text.
              </p>
              <p className="text-xs text-muted-foreground">
                Reviews are tagged by source platform (TripAdvisor, Expedia, Google, etc.)
              </p>
            </div>
            <Button onClick={handleDiscover} size="lg">
              <Search className="mr-2 h-4 w-4" />
              Discover Properties
            </Button>
          </div>
        )}

        {step === 'discovering' && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Discovering Kasa properties...</p>
          </div>
        )}

        {step === 'selecting' && (
          <div className="flex flex-col flex-1 min-h-0 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found {discoveredProperties.length} properties • {selectedCount} selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-2 space-y-1">
                {discoveredProperties.map(prop => (
                  <label
                    key={prop.slug}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      prop.selected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      checked={prop.selected}
                      onCheckedChange={() => toggleProperty(prop.slug)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{prop.name}</span>
                        {prop.matchedPropertyId && (
                          <Badge variant="secondary" className="shrink-0">
                            <Link2 className="h-3 w-3 mr-1" />
                            Matched
                          </Badge>
                        )}
                      </div>
                      {prop.matchedPropertyName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Will update: {prop.matchedPropertyName}
                        </p>
                      )}
                      {!prop.matchedPropertyId && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Will create new property
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={selectedCount === 0}>
                Import {selectedCount} {selectedCount === 1 ? 'Property' : 'Properties'}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-6 space-y-4">
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
          </div>
        )}

        {step === 'complete' && (
          <div className="py-6 space-y-4">
            <div className="flex flex-col items-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold">Import Complete</h3>
              <p className="text-sm text-muted-foreground text-center">
                {importResults.filter(r => r.success).length} of {importResults.length} properties imported
              </p>
            </div>

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
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
