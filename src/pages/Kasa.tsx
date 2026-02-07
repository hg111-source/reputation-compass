import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProperties } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import { useBulkInsights } from '@/hooks/useBulkInsights';
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
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Loader2, Star, ExternalLink, MapPin, Building2, Home, Info, TrendingUp, Sparkles, Brain } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScoreLegend } from '@/components/properties/ScoreLegend';
import { ReviewInsightsDialog } from '@/components/properties/ReviewInsightsDialog';
import { BulkInsightsDialog } from '@/components/properties/BulkInsightsDialog';

import { getScoreColor } from '@/lib/scoring';
import { Property, ReviewSource } from '@/lib/types';
import { SortableTableHead, SortDirection } from '@/components/properties/SortableTableHead';
import { TableHead } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type SortKey = 'name' | 'location' | 'type' | 'score' | 'reviews' | null;

// Property type mapping based on official Kasa.com classifications
const PROPERTY_TYPES: Record<string, 'Apartment' | 'Hotel'> = {
  // Hotels
  'kasa-del-ray-alexandria': 'Hotel',
  'the-king-street-house-by-kasa-hotels-alexandria': 'Hotel',
  'the-bell-athens-by-kasa': 'Hotel',
  'studio-haus-east-6th-austin-by-kasa-hotel': 'Hotel',
  'hillsboro-beach-resort-by-kasa-hotel': 'Hotel',
  'kasa-niche-hotel-redwood-city': 'Hotel',
  'kasa-la-monarca-san-francisco': 'Hotel',
  'kasa-la-monarca-residential-san-francisco': 'Hotel',
  'the-hotel-castro-san-francisco': 'Hotel',
  'the-maverick-pittsburgh': 'Hotel', // Actually listed as Hotel on site
  'mint-house-at-70-pine-by-kasa-new-york-city': 'Hotel',
  'kasa-gold-coast-inn-traverse-city': 'Hotel',
  'kasa-539-bay-street-traverse-city': 'Hotel',
  'boardwalk-suites-and-residences-by-kasa-traverse-city': 'Hotel',
  'the-vic-hotel-by-kasa-traverse-city': 'Hotel',
  'boardwalk-hotel-on-lake-anna-by-kasa': 'Hotel',
  'kasa-cadillac-square-detroit': 'Hotel',
  'kasa-the-niche-university-city-philadelphia': 'Hotel',
  'the-lafayette-new-orleans-by-kasa': 'Hotel',
  'the-frenchmen-new-orleans-by-kasa': 'Hotel',
  'the-skowhegan-by-kasa': 'Hotel',
  'the-dexter-elk-rapids-hotel-by-kasa': 'Hotel',
  'city-center-hotel-by-kasa-long-beach': 'Hotel',
  'mint-house-st-petersburg-downtown-by-kasa': 'Hotel',
  'mint-house-nashville-marathon-village-by-kasa': 'Hotel',
  'mint-house-greenville-downtown-by-kasa': 'Hotel',
  'kasa-gaslamp-quarter-san-diego': 'Hotel',
  'the-davis-downtown-san-diego-hotel': 'Hotel',
  'kasa-capitol-hill-downtown-nashville': 'Hotel',
  'kasa-la-flora-miami-beach': 'Hotel',
  'kasa-impala-miami-beach': 'Hotel',
  'kasa-el-paseo-miami-beach': 'Hotel',
  'the-clyde-hotel-portland-by-kasa': 'Hotel',
  'kasa-jules-savannah': 'Apartment', // Listed as Apartment
  'kasa-altmayer-savannah': 'Hotel',
  'mint-house-washington-dc-downtown-by-kasa': 'Hotel',
  // Apartments (default for most Kasa-prefixed properties)
  'kasa-alexandria-washington': 'Apartment',
  'kasa-at-the-waller-apartment-austin': 'Apartment',
  'kasa-downtown-austin': 'Apartment',
  'kasa-lady-bird-lake-austin': 'Apartment',
  'kasa-2nd-street-austin': 'Apartment',
  'kasa-bellevue-seattle': 'Apartment',
  'kasa-love-field-medical-district-dallas': 'Apartment',
  'mint-house-dallas-downtown-by-kasa': 'Apartment',
  'kasa-little-italy-san-diego': 'Apartment',
  'kasa-at-artisan-music-row-nashville': 'Apartment',
  'the-eighteen-by-kasa-nashville': 'Apartment',
  'kasa-at-cortland-hollywood-ft-lauderdale': 'Apartment',
  'tucker-at-palm-trace-landings-fort-lauderdale': 'Apartment',
  'kasa-scottsdale-quarter-phoenix': 'Apartment',
  'kasa-union-station-denver': 'Apartment',
  'kasa-rino-denver': 'Apartment',
  'kasa-bryn-mawr-minneapolis': 'Apartment',
  'kasa-the-addison-san-francisco': 'Apartment',
  'kasa-university-airport-santa-clara': 'Apartment',
  'kasa-downtown-des-moines': 'Apartment',
  'kasa-wellington-south-florida': 'Apartment',
  'kasa-south-side-pittsburgh': 'Apartment',
  'kasa-westown-milwaukee': 'Apartment',
  'kasa-lantern-les': 'Apartment',
  'kasa-at-berkshire-village-district-raleigh': 'Apartment',
  'kasa-archive-reno-tahoe': 'Apartment',
  'kasa-edison-house-charlotte': 'Apartment',
  'kasa-kasa-dilworth-charlotte': 'Apartment',
  'kasa-freemorewest-charlotte': 'Apartment',
  'kasa-at-cortland-noda-charlotte': 'Apartment',
  'kasa-southside-wilmington': 'Apartment',
  'stile-downtown-los-angeles-by-kasa': 'Hotel',
  'kasa-sunset-los-angeles': 'Apartment',
  'kasa-collins-park-miami-beach-convention-center': 'Apartment',
  'kasa-at-cortland-on-the-river-boise': 'Apartment',
  'tucker-at-palmer-dadeland-miami': 'Apartment',
  'kasa-wynwood-miami': 'Apartment',
  'the-loop-downtown-traverse-city-apartments-by-kasa': 'Apartment',
  'kasa-south-loop-chicago': 'Apartment',
  'kasa-river-north-chicago': 'Apartment',
  'kasa-magnificent-mile-chicago': 'Apartment',
  'mint-house-menlo-park-by-kasa': 'Apartment',
  'mint-house-tampa-downtown-by-kasa': 'Apartment',
};

// Helper to get property type from URL
function getPropertyType(kasaUrl: string | null): 'Apartment' | 'Hotel' {
  if (!kasaUrl) return 'Apartment';
  const slug = kasaUrl.split('/properties/')[1]?.split('?')[0] || '';
  return PROPERTY_TYPES[slug] || 'Apartment';
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
  }>;
}

export default function Kasa() {
  const { user, loading } = useAuth();
  const { properties } = useProperties();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const batchSaveSnapshots = useBatchSaveKasaSnapshots();

  const [isImporting, setIsImporting] = useState(false);
  const [isUpdatingMissing, setIsUpdatingMissing] = useState(false);
  const [isFixingLocations, setIsFixingLocations] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [currentProperty, setCurrentProperty] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [insightsProperty, setInsightsProperty] = useState<Property | null>(null);
  const [isBulkInsightsOpen, setIsBulkInsightsOpen] = useState(false);
  const bulkInsights = useBulkInsights();

  // Filter properties that have Kasa data
  const kasaProperties = useMemo(() => {
    return properties.filter(p => p.kasa_url || p.kasa_aggregated_score);
  }, [properties]);

  const kasaPropertyIds = useMemo(() => kasaProperties.map(p => p.id), [kasaProperties]);
  
  // Track which properties have fetched review data
  const { data: propertiesWithReviews = new Set<string>() } = useQuery({
    queryKey: ['properties-with-reviews', user?.id, 'kasa'],
    queryFn: async () => {
      if (!user || kasaPropertyIds.length === 0) return new Set<string>();
      const { data, error } = await supabase
        .from('review_texts')
        .select('property_id')
        .in('property_id', kasaPropertyIds);
      if (error) throw error;
      return new Set(data?.map(r => r.property_id) || []);
    },
    enabled: !!user && kasaPropertyIds.length > 0,
  });

  // Fetch latest Kasa snapshots for weighted average calculation
  const { data: kasaSnapshots = {} } = useLatestKasaSnapshots(kasaPropertyIds);
  
  // Calculate weighted portfolio stats from snapshots
  const portfolioStats = useMemo(() => {
    return calculateWeightedAverage(kasaSnapshots);
  }, [kasaSnapshots]);

  // Fallback to properties table if no snapshots exist yet
  // Using simple average (each property counts equally) since Kasa scores are already weighted averages
  const displayStats = useMemo(() => {
    if (portfolioStats.totalProperties > 0 && portfolioStats.simpleAverage !== null) {
      return {
        avgScore: portfolioStats.simpleAverage / 2, // Convert back to 5-scale for display
        totalReviews: portfolioStats.totalReviews,
        propertyCount: portfolioStats.totalProperties,
        source: 'snapshots' as const,
      };
    }
    
    // Fallback: Calculate simple average from properties table
    const withScores = kasaProperties.filter(p => p.kasa_aggregated_score != null);
    if (withScores.length === 0) {
      return { avgScore: null, totalReviews: 0, propertyCount: 0, source: 'properties' as const };
    }
    
    const scores = withScores.map(p => Number(p.kasa_aggregated_score) || 0);
    const simpleAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const totalReviews = withScores.reduce((sum, p) => sum + (p.kasa_review_count || 0), 0);
    
    return {
      avgScore: simpleAvg,
      totalReviews,
      propertyCount: withScores.length,
      source: 'properties' as const,
    };
  }, [portfolioStats, kasaProperties]);

  // Sorting handler - same pattern as Properties page
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

  // Count properties with unknown locations
  const unknownLocationCount = useMemo(() => {
    return kasaProperties.filter(p => !p.city || p.city === 'Unknown' || p.city === '').length;
  }, [kasaProperties]);

  // Count properties with missing scores (no snapshot and no property score)
  const propertiesWithMissingScores = useMemo(() => {
    return kasaProperties.filter(p => {
      const snapshot = kasaSnapshots[p.id];
      const hasScore = snapshot?.score_raw != null || p.kasa_aggregated_score != null;
      return !hasScore;
    });
  }, [kasaProperties, kasaSnapshots]);

  // Compute locations with property counts for dropdown
  const locationOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    kasaProperties.forEach(p => {
      const loc = p.city && p.state ? `${p.city}, ${p.state}` : p.city || 'Unknown';
      counts[loc] = (counts[loc] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([location, count]) => ({
        value: location,
        label: `${location} (${count})`,
      }));
  }, [kasaProperties]);

  // Sorted and filtered properties
  const sortedKasaProperties = useMemo(() => {
    // First filter by location
    let filtered = kasaProperties;
    if (locationFilter !== 'all') {
      filtered = kasaProperties.filter(p => {
        const loc = p.city && p.state ? `${p.city}, ${p.state}` : p.city || 'Unknown';
        return loc === locationFilter;
      });
    }

    // Then sort
    if (!sortKey || !sortDirection) return filtered;

    return [...filtered].sort((a, b) => {
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
        case 'type':
          aVal = getPropertyType(a.kasa_url);
          bVal = getPropertyType(b.kasa_url);
          break;
        case 'score':
          const aSnapshot = kasaSnapshots[a.id];
          const bSnapshot = kasaSnapshots[b.id];
          aVal = aSnapshot?.score_raw ?? a.kasa_aggregated_score ?? -1;
          bVal = bSnapshot?.score_raw ?? b.kasa_aggregated_score ?? -1;
          break;
        case 'reviews':
          const aSnap = kasaSnapshots[a.id];
          const bSnap = kasaSnapshots[b.id];
          aVal = aSnap?.review_count ?? a.kasa_review_count ?? -1;
          bVal = bSnap?.review_count ?? b.kasa_review_count ?? -1;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [kasaProperties, kasaSnapshots, sortKey, sortDirection, locationFilter]);

  // Fix unknown locations by re-crawling those properties
  const handleFixUnknownLocations = async () => {
    const unknownProps = kasaProperties.filter(p => !p.city || p.city === 'Unknown' || p.city === '');
    
    if (unknownProps.length === 0) {
      toast({ title: 'No unknown locations', description: 'All properties have locations.' });
      return;
    }

    setIsFixingLocations(true);
    setImportProgress(0);

    let fixedCount = 0;

    try {
      for (let i = 0; i < unknownProps.length; i++) {
        const prop = unknownProps[i];
        setCurrentProperty(`Fixing location for ${prop.name}...`);
        setImportProgress(Math.round(((i + 1) / unknownProps.length) * 100));

        try {
          // Extract slug from URL
          const slug = prop.kasa_url?.split('/properties/')[1]?.split('?')[0] || '';
          
          const { data: propData, error: propError } = await supabase.functions.invoke('fetch-kasa-property', {
            body: { url: prop.kasa_url, slug },
          });

          if (propError || !propData?.success) {
            console.error('Failed to fetch', prop.name, propData?.error || propError?.message);
            continue;
          }

          const propertyInfo = propData.property;
          
          // Only update if we found a location
          if (propertyInfo.city && propertyInfo.city !== 'Unknown') {
            await supabase
              .from('properties')
              .update({
                city: propertyInfo.city,
                state: propertyInfo.state || prop.state,
              })
              .eq('id', prop.id);
            
            fixedCount++;
            console.log(`Fixed location for ${prop.name}: ${propertyInfo.city}, ${propertyInfo.state}`);
          }
        } catch (error) {
          console.error('Error fixing location for', prop.name, error);
        }

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      queryClient.invalidateQueries({ queryKey: ['properties'] });

      toast({
        title: 'Location fix complete',
        description: `Fixed ${fixedCount}/${unknownProps.length} property locations`,
      });

    } catch (error) {
      console.error('Fix locations error:', error);
      toast({
        variant: 'destructive',
        title: 'Fix failed',
        description: error instanceof Error ? error.message : 'Failed to fix locations',
      });
    } finally {
      setIsFixingLocations(false);
      setImportProgress(0);
      setCurrentProperty(null);
    }
  };

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

  // Update only properties with missing scores
  const handleUpdateMissing = async () => {
    if (propertiesWithMissingScores.length === 0) {
      toast({ title: 'All complete', description: 'No properties with missing scores found.' });
      return;
    }

    setIsUpdatingMissing(true);
    setImportProgress(0);

    const snapshotsToSave: Array<{
      propertyId: string;
      rating: number | null;
      reviewCount: number;
    }> = [];

    let successCount = 0;
    const errors: Array<{ name: string; error: string }> = [];

    try {
      for (let i = 0; i < propertiesWithMissingScores.length; i++) {
        const prop = propertiesWithMissingScores[i];
        setCurrentProperty(`Updating ${prop.name}...`);
        setImportProgress(Math.round(((i + 1) / propertiesWithMissingScores.length) * 100));

        try {
          // Extract slug from URL
          const slug = prop.kasa_url?.split('/properties/')[1]?.split('?')[0] || '';
          
          if (!slug) {
            errors.push({ name: prop.name, error: 'No Kasa URL found' });
            console.warn(`⚠️ ${prop.name}: No Kasa URL, skipping`);
            continue;
          }

          console.log(`🔄 Fetching ${prop.name} (slug: ${slug})`);
          
          const { data: propData, error: propError } = await supabase.functions.invoke('fetch-kasa-property', {
            body: { url: prop.kasa_url, slug },
          });

          if (propError) {
            const errorMsg = propError.message || 'Edge function error';
            errors.push({ name: prop.name, error: errorMsg });
            console.error(`❌ ${prop.name}: ${errorMsg}`);
            continue;
          }

          if (!propData?.success) {
            const errorMsg = propData?.error || 'Unknown fetch error';
            // Check for 404 specifically
            if (errorMsg.includes('404') || errorMsg.includes('not found')) {
              errors.push({ name: prop.name, error: 'Property page not found (404) - URL may have changed' });
              console.error(`❌ ${prop.name}: 404 - URL may have changed`);
            } else {
              errors.push({ name: prop.name, error: errorMsg });
              console.error(`❌ ${prop.name}: ${errorMsg}`);
            }
            continue;
          }

          const propertyInfo: ImportedPropertyData = propData.property;
          
          // Update property record
          await supabase
            .from('properties')
            .update({
              kasa_aggregated_score: propertyInfo.aggregatedRating,
              kasa_review_count: propertyInfo.reviewCount,
              city: propertyInfo.city || prop.city,
              state: propertyInfo.state || prop.state,
            })
            .eq('id', prop.id);

          // Queue snapshot
          snapshotsToSave.push({
            propertyId: prop.id,
            rating: propertyInfo.aggregatedRating,
            reviewCount: propertyInfo.reviewCount,
          });

          successCount++;
          console.log(`✅ ${prop.name}: ${propertyInfo.aggregatedRating} (${propertyInfo.reviewCount} reviews)`);
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ name: prop.name, error: errorMsg });
          console.error(`❌ ${prop.name}:`, error);
        }

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Batch save snapshots
      if (snapshotsToSave.length > 0) {
        try {
          await batchSaveSnapshots.mutateAsync(snapshotsToSave);
          console.log(`💾 Saved ${snapshotsToSave.length} snapshots`);
        } catch (err) {
          console.error('Failed to save snapshots:', err);
        }
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['kasa-snapshots'] });

      // Log errors summary
      if (errors.length > 0) {
        console.group('⚠️ Failed properties:');
        errors.forEach(e => console.error(`  ${e.name}: ${e.error}`));
        console.groupEnd();
      }

      toast({
        title: 'Update complete',
        description: `${successCount}/${propertiesWithMissingScores.length} updated successfully${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
        variant: errors.length > 0 ? 'default' : 'default',
      });

    } catch (error) {
      console.error('Update missing error:', error);
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to update properties',
      });
    } finally {
      setIsUpdatingMissing(false);
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

          <div className="flex gap-2">
            {unknownLocationCount > 0 && (
              <Button 
                variant="outline" 
                onClick={handleFixUnknownLocations} 
                disabled={isImporting || isFixingLocations}
              >
                {isFixingLocations ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2 h-4 w-4" />
                    Fix {unknownLocationCount} Unknown Locations
                  </>
                )}
              </Button>
            )}
            {propertiesWithMissingScores.length > 0 && (
              <Button 
                variant="outline" 
                onClick={handleUpdateMissing} 
                disabled={isImporting || isFixingLocations || isUpdatingMissing}
              >
                {isUpdatingMissing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Update {propertiesWithMissingScores.length} Missing
                  </>
                )}
              </Button>
            )}
            <Button onClick={handleImportFromKasa} disabled={isImporting || isFixingLocations || isUpdatingMissing}>
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
        </div>

        {/* Import/Fix/Update Progress */}
        {(isImporting || isFixingLocations || isUpdatingMissing) && (
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

        {/* Content */}
        <div className="space-y-6">
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
                    Portfolio Average
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-sm" side="top">
                          <p className="font-medium mb-1">Simple average of all property scores.</p>
                          <p className="text-muted-foreground">
                            Each property's imported score from Kasa.com is assumed to already be a weighted average of reviews across platforms, so we don't double-weight by review count here.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardDescription>
                  <CardTitle className="text-3xl flex items-center gap-2">
                    {displayStats.avgScore !== null ? (
                      <>
                        <Star className="h-6 w-6 fill-primary text-primary" />
                        {(displayStats.avgScore * 2).toFixed(2)}/10
                      </>
                    ) : (
                      '—'
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">
                    Avg of {displayStats.propertyCount || kasaProperties.length} property scores
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Kasa Properties</CardTitle>
                    <CardDescription>
                      {locationFilter === 'all' 
                        ? `${kasaProperties.length} properties with Kasa ratings`
                        : `${sortedKasaProperties.length} of ${kasaProperties.length} properties in ${locationFilter}`
                      }
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <ScoreLegend />
                    <Select value={locationFilter} onValueChange={setLocationFilter}>
                      <SelectTrigger className="w-[220px]">
                        <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Filter by location" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="all">All Locations ({kasaProperties.length})</SelectItem>
                        {locationOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
                        <SortableTableHead
                          sortKey="name"
                          currentSort={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                          className="text-left"
                        >
                          Property Name
                        </SortableTableHead>
                        <SortableTableHead
                          sortKey="location"
                          currentSort={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                          className="text-left"
                        >
                          Location
                        </SortableTableHead>
                        <SortableTableHead
                          sortKey="type"
                          currentSort={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                          className="text-center"
                        >
                          Type
                        </SortableTableHead>
                        <SortableTableHead
                          sortKey="score"
                          currentSort={sortKey}
                          currentDirection={sortDirection}
                          onSort={handleSort}
                          className="text-center"
                        >
                          Kasa.com
                        </SortableTableHead>
                        
                        <TableHead className="text-center">
                          <div className="flex items-center justify-start gap-1">
                            <span className="text-xs font-semibold text-muted-foreground">Insights</span>
                            <button
                              onClick={() => {
                                setIsBulkInsightsOpen(true);
                                bulkInsights.run(sortedKasaProperties);
                              }}
                              disabled={bulkInsights.isRunning}
                              className="p-0.5 rounded hover:bg-muted/50"
                              title="Fetch AI insights for all Kasa properties"
                            >
                              <Brain className={cn('h-3.5 w-3.5 text-orange-500 hover:text-orange-600', bulkInsights.isRunning && 'animate-pulse text-accent')} />
                            </button>
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                    {sortedKasaProperties.map(property => {
                        const snapshot = kasaSnapshots[property.id];
                        const score5 = snapshot?.score_raw ?? property.kasa_aggregated_score;
                        const score10 = score5 ? Number(score5) * 2 : null;
                        const reviewCount = snapshot?.review_count ?? property.kasa_review_count;
                        const isHotel = getPropertyType(property.kasa_url) === 'Hotel';
                        
                        return (
                          <TableRow 
                            key={property.id} 
                            className={isHotel ? 'bg-muted/30' : ''}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {property.name}
                                {property.kasa_url && (
                                  <a
                                    href={property.kasa_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex text-muted-foreground hover:text-foreground"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {property.city}{property.state ? `, ${property.state}` : ''}
                            </TableCell>
                            <TableCell className="text-center">
                              {(() => {
                                const type = getPropertyType(property.kasa_url);
                                return type === 'Hotel' ? (
                                  <Badge variant="secondary" className="gap-1">
                                    <Building2 className="h-3 w-3" />
                                    Hotel
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="gap-1">
                                    <Home className="h-3 w-3" />
                                    Apt
                                  </Badge>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                {score10 !== null ? (
                                  <>
                                    <span className={`font-semibold ${getScoreColor(score10)}`}>
                                      {score10.toFixed(2)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {reviewCount ? reviewCount.toLocaleString() : '—'}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  'h-7 gap-1 text-xs',
                                  propertiesWithReviews.has(property.id) && 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/50'
                                )}
                                onClick={() => setInsightsProperty(property)}
                                title="Analyze reviews with AI"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                Insights
                              </Button>
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
      </div>

      {/* Insights Dialog */}
      <ReviewInsightsDialog
        open={!!insightsProperty}
        onOpenChange={(open) => !open && setInsightsProperty(null)}
        property={insightsProperty}
      />

      {/* Bulk Insights Dialog */}
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
    </DashboardLayout>
  );
}
