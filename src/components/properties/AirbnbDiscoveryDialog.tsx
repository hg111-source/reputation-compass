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
import { Search, Loader2, Check, AlertCircle, Home, Link2 } from 'lucide-react';

interface DiscoveredListing {
  title: string;
  url: string;
  roomId: string;
  snippet?: string;
  selected: boolean;
  matchedPropertyId?: string;
  matchedPropertyName?: string;
}

interface ImportResult {
  roomId: string;
  success: boolean;
  error?: string;
  propertyId?: string;
  propertyName?: string;
  isNew: boolean;
}

interface AirbnbDiscoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AirbnbDiscoveryDialog({ open, onOpenChange }: AirbnbDiscoveryDialogProps) {
  const { user } = useAuth();
  const { properties } = useProperties();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'idle' | 'discovering' | 'selecting' | 'importing' | 'complete'>('idle');
  const [listings, setListings] = useState<DiscoveredListing[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [currentImport, setCurrentImport] = useState<string | null>(null);

  const handleDiscover = async () => {
    setStep('discovering');
    setListings([]);

    try {
      const { data, error } = await supabase.functions.invoke('discover-airbnb-listings', {
        body: { query: 'site:airbnb.com "hosted by Kasa"', num: 100 },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Discovery failed');
      }

      // Match listings to existing properties
      const matchedListings: DiscoveredListing[] = data.listings.map((listing: any) => {
        const normalizedListingName = normalizeHotelName(listing.title);
        
        // Try to find a matching property
        let matchedProperty = null;
        for (const prop of properties) {
          const normalizedPropName = normalizeHotelName(prop.name);
          
          // Check if names are similar enough
          if (normalizedListingName.includes(normalizedPropName) || 
              normalizedPropName.includes(normalizedListingName) ||
              normalizedListingName === normalizedPropName) {
            matchedProperty = prop;
            break;
          }
          
          // Also check if listing title contains property city
          if (listing.title.toLowerCase().includes(prop.city.toLowerCase()) &&
              normalizedListingName.split(' ').some((word: string) => 
                normalizedPropName.includes(word) && word.length > 3
              )) {
            matchedProperty = prop;
            break;
          }
        }

        return {
          ...listing,
          selected: true,
          matchedPropertyId: matchedProperty?.id,
          matchedPropertyName: matchedProperty?.name,
        };
      });

      setListings(matchedListings);
      setStep('selecting');

      if (matchedListings.length === 0) {
        toast({
          title: 'No listings found',
          description: 'No Kasa Airbnb listings were discovered. Try a different search.',
        });
        setStep('idle');
      }
    } catch (error) {
      console.error('Discovery error:', error);
      toast({
        variant: 'destructive',
        title: 'Discovery failed',
        description: error instanceof Error ? error.message : 'Failed to discover listings',
      });
      setStep('idle');
    }
  };

  const toggleListing = (roomId: string) => {
    setListings(prev => prev.map(l => 
      l.roomId === roomId ? { ...l, selected: !l.selected } : l
    ));
  };

  const selectAll = () => {
    setListings(prev => prev.map(l => ({ ...l, selected: true })));
  };

  const deselectAll = () => {
    setListings(prev => prev.map(l => ({ ...l, selected: false })));
  };

  const handleImport = async () => {
    const selectedListings = listings.filter(l => l.selected);
    if (selectedListings.length === 0) {
      toast({ variant: 'destructive', title: 'No listings selected' });
      return;
    }

    setStep('importing');
    setImportProgress(0);
    setImportResults([]);

    const results: ImportResult[] = [];

    for (let i = 0; i < selectedListings.length; i++) {
      const listing = selectedListings[i];
      setCurrentImport(listing.title);
      setImportProgress(Math.round((i / selectedListings.length) * 100));

      try {
        // Fetch reviews from Airbnb
        const { data: reviewData, error: reviewError } = await supabase.functions.invoke('fetch-airbnb-reviews', {
          body: { roomId: listing.roomId, maxReviews: 25 },
        });

        if (reviewError || !reviewData?.success) {
          throw new Error(reviewData?.error || reviewError?.message || 'Failed to fetch reviews');
        }

        let propertyId = listing.matchedPropertyId;
        let propertyName = listing.matchedPropertyName;
        let isNew = false;

        // If no match, create new property
        if (!propertyId) {
          const { data: newProp, error: propError } = await supabase
            .from('properties')
            .insert({
              name: reviewData.name || listing.title,
              city: reviewData.city || 'Unknown',
              state: reviewData.state || 'Unknown',
              user_id: user!.id,
            })
            .select()
            .single();

          if (propError) throw propError;
          propertyId = newProp.id;
          propertyName = newProp.name;
          isNew = true;
        }

        // Store Airbnb alias
        await supabase.from('hotel_aliases').upsert({
          property_id: propertyId,
          source: 'google', // We'll use google as placeholder until airbnb is added to enum
          source_id_or_url: listing.url,
          platform_url: listing.url,
          resolution_status: 'resolved',
          confidence_score: 1.0,
          source_name_raw: listing.title,
          last_resolved_at: new Date().toISOString(),
          last_verified_at: new Date().toISOString(),
        }, {
          onConflict: 'property_id,source',
        });

        // Store reviews in review_texts table
        if (reviewData.reviews && reviewData.reviews.length > 0) {
          const reviewInserts = reviewData.reviews.map((review: any) => ({
            property_id: propertyId,
            platform: 'google' as const, // Placeholder until airbnb enum is added
            review_text: review.text,
            review_rating: review.rating,
            reviewer_name: review.reviewerName,
            review_date: review.date,
          }));

          await supabase.from('review_texts').insert(reviewInserts);
        }

        // Create a snapshot with the rating
        if (reviewData.rating) {
          await supabase.from('source_snapshots').insert({
            property_id: propertyId,
            source: 'google' as const, // Placeholder
            score_raw: reviewData.rating,
            score_scale: 5,
            normalized_score_0_10: (reviewData.rating / 5) * 10,
            review_count: reviewData.reviewsCount || reviewData.reviews?.length || 0,
            status: 'found',
          });
        }

        results.push({
          roomId: listing.roomId,
          success: true,
          propertyId,
          propertyName,
          isNew,
        });

      } catch (error) {
        console.error('Import error for', listing.title, error);
        results.push({
          roomId: listing.roomId,
          success: false,
          error: error instanceof Error ? error.message : 'Import failed',
          propertyName: listing.title,
          isNew: false,
        });
      }

      setImportResults([...results]);
    }

    setImportProgress(100);
    setCurrentImport(null);
    setStep('complete');

    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['properties'] });
    queryClient.invalidateQueries({ queryKey: ['hotel-aliases'] });
    queryClient.invalidateQueries({ queryKey: ['review-count'] });

    const successCount = results.filter(r => r.success).length;
    const newCount = results.filter(r => r.isNew).length;
    
    toast({
      title: 'Import complete',
      description: `${successCount}/${results.length} listings imported (${newCount} new properties created)`,
    });
  };

  const handleClose = () => {
    setStep('idle');
    setListings([]);
    setImportProgress(0);
    setImportResults([]);
    onOpenChange(false);
  };

  const selectedCount = listings.filter(l => l.selected).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Discover Kasa Airbnb Listings
          </DialogTitle>
          <DialogDescription>
            Automatically find and import all Kasa-hosted Airbnb properties
          </DialogDescription>
        </DialogHeader>

        {step === 'idle' && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <p className="text-center text-muted-foreground max-w-sm">
              Search for all Airbnb listings hosted by Kasa and import them into your portfolio.
            </p>
            <Button onClick={handleDiscover} size="lg">
              <Search className="mr-2 h-4 w-4" />
              Discover Kasa Listings
            </Button>
          </div>
        )}

        {step === 'discovering' && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Searching for Kasa Airbnb listings...</p>
          </div>
        )}

        {step === 'selecting' && (
          <div className="flex flex-col flex-1 min-h-0 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found {listings.length} listings • {selectedCount} selected
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
                {listings.map(listing => (
                  <label
                    key={listing.roomId}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      listing.selected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      checked={listing.selected}
                      onCheckedChange={() => toggleListing(listing.roomId)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{listing.title}</span>
                        {listing.matchedPropertyId && (
                          <Badge variant="secondary" className="shrink-0">
                            <Link2 className="h-3 w-3 mr-1" />
                            Matched
                          </Badge>
                        )}
                      </div>
                      {listing.matchedPropertyName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Will link to: {listing.matchedPropertyName}
                        </p>
                      )}
                      {!listing.matchedPropertyId && (
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
                Import {selectedCount} Listing{selectedCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Importing {importResults.length + 1}/{listings.filter(l => l.selected).length}...
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
                      key={result.roomId}
                      className={`flex items-center gap-2 p-2 rounded text-sm ${
                        result.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                      }`}
                    >
                      {result.success ? (
                        <Check className="h-4 w-4 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span className="truncate">
                        {result.propertyName}
                        {result.isNew && <span className="text-muted-foreground"> (new)</span>}
                      </span>
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
                {importResults.filter(r => r.success).length} of {importResults.length} listings imported successfully
              </p>
            </div>

            <ScrollArea className="h-48 border rounded-lg">
              <div className="p-2 space-y-1">
                {importResults.map(result => (
                  <div
                    key={result.roomId}
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
                      <Badge variant="secondary" className="shrink-0">Linked</Badge>
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
