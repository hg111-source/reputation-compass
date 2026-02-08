import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export type Platform = 'google' | 'tripadvisor' | 'booking' | 'expedia';
export type RefreshPhase = 'idle' | 'normalizing' | 'resolving' | 'fetching' | 'complete';
export type RefreshStatus = 'queued' | 'resolving' | 'fetching' | 'complete' | 'failed' | 'not_listed';

export interface PlatformRefreshState {
  platform: Platform;
  status: RefreshStatus;
  error?: string;
}

export interface PropertyRefreshState {
  property: Property;
  phase: RefreshPhase;
  platforms: PlatformRefreshState[];
  urlsResolved?: boolean;
}

const DELAY_BETWEEN_CALLS_MS = 5000;
const RETRY_DELAY_MS = 10000;
const MAX_RETRIES = 1;

/** Fire-and-forget: fetch reviews then run AI analysis for a single property */
async function fetchInsightsForProperty(property: Property, queryClient?: any): Promise<void> {
  console.log(`[auto-insights] Starting for ${property.name}`);
  
  // Step 1: Fetch reviews from all available platforms
  await supabase.functions.invoke('fetch-reviews', {
    body: {
      propertyId: property.id,
      hotelName: property.name,
      city: property.city,
      platform: 'all',
      maxReviews: 25,
    },
  });

  // Step 2: Run AI analysis
  const { data, error } = await supabase.functions.invoke('analyze-reviews', {
    body: { propertyId: property.id },
  });

  if (error || data?.error) {
    console.warn(`[auto-insights] Analysis failed for ${property.name}:`, error?.message || data?.error);
    return;
  }

  console.log(`[auto-insights] ${property.name} complete`);
  if (queryClient) {
    queryClient.invalidateQueries({ queryKey: ['review-analysis', property.id] });
    queryClient.invalidateQueries({ queryKey: ['review-texts-count', property.id] });
    queryClient.invalidateQueries({ queryKey: ['properties-with-reviews'] });
  }
}

const PLATFORM_CONFIG: Record<Platform, { displayName: string; scale: number; functionName: string }> = {
  google: { displayName: 'Google', scale: 5, functionName: 'fetch-place-rating' },
  tripadvisor: { displayName: 'TripAdvisor', scale: 5, functionName: 'fetch-tripadvisor-rating' },
  booking: { displayName: 'Booking.com', scale: 10, functionName: 'fetch-booking-rating' },
  expedia: { displayName: 'Expedia', scale: 10, functionName: 'fetch-expedia-rating' },
};

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function useUnifiedRefresh() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<RefreshPhase>('idle');
  const [currentPlatform, setCurrentPlatform] = useState<Platform | null>(null);
  const [propertyStates, setPropertyStates] = useState<PropertyRefreshState[]>([]);
  const dialogOpenRef = useRef(true);

  const updatePropertyPhase = useCallback((propertyId: string, phase: RefreshPhase) => {
    setPropertyStates(prev =>
      prev.map(p => p.property.id === propertyId ? { ...p, phase } : p)
    );
  }, []);

  const updatePlatformStatus = useCallback((
    propertyId: string,
    platform: Platform,
    status: RefreshStatus,
    error?: string
  ) => {
    setPropertyStates(prev =>
      prev.map(p =>
        p.property.id === propertyId
          ? {
              ...p,
              platforms: p.platforms.map(pl =>
                pl.platform === platform ? { ...pl, status, error } : pl
              ),
            }
          : p
      )
    );
  }, []);

  // STEP 1: Resolve URLs if missing - only resolves specified platforms
  const resolvePropertyUrls = useCallback(async (
    property: Property,
    platformsToResolve: Platform[] = ['booking', 'tripadvisor', 'expedia']
  ): Promise<{ success: boolean; hotelIds?: Record<string, string>; updatedProperty?: Property }> => {
    // Filter out google since it doesn't use URL resolution
    const platforms = platformsToResolve.filter(p => p !== 'google');
    
    if (platforms.length === 0) {
      return { success: true, updatedProperty: property };
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('resolve-hotel-urls', {
        body: {
          hotelName: property.name,
          city: property.city,
          state: property.state,
          platforms,
        },
      });

      if (error || data.error) {
        console.error('URL resolution failed:', error || data.error);
        return { success: false };
      }

      // Update property URLs
      const urls = data.urls || {};
      const hotelIds = data.hotelIds || {};
      const updateData: Record<string, string | null> = {};
      
      if (urls.booking_url) updateData.booking_url = urls.booking_url;
      if (urls.tripadvisor_url) updateData.tripadvisor_url = urls.tripadvisor_url;
      if (urls.expedia_url) updateData.expedia_url = urls.expedia_url;

      if (Object.keys(updateData).length > 0) {
        await supabase.from('properties').update(updateData).eq('id', property.id);
      }

      // Store aliases for resolved platforms
      const aliasInserts: Array<{
        property_id: string;
        source: Platform;
        platform_url: string;
        platform_id?: string;
        source_id_or_url: string;
        resolution_status: string;
        last_resolved_at: string;
      }> = [];
      
      if (urls.booking_url && platforms.includes('booking')) {
        aliasInserts.push({
          property_id: property.id,
          source: 'booking',
          platform_url: urls.booking_url,
          source_id_or_url: urls.booking_url,
          resolution_status: 'resolved',
          last_resolved_at: new Date().toISOString(),
        });
      }
      
      if (urls.tripadvisor_url && platforms.includes('tripadvisor')) {
        aliasInserts.push({
          property_id: property.id,
          source: 'tripadvisor',
          platform_url: urls.tripadvisor_url,
          source_id_or_url: urls.tripadvisor_url,
          resolution_status: 'resolved',
          last_resolved_at: new Date().toISOString(),
        });
      }
      
      if (urls.expedia_url && platforms.includes('expedia')) {
        aliasInserts.push({
          property_id: property.id,
          source: 'expedia',
          platform_url: urls.expedia_url,
          platform_id: hotelIds.expedia_hotel_id,
          source_id_or_url: urls.expedia_url,
          resolution_status: 'resolved',
          last_resolved_at: new Date().toISOString(),
        });
      }
      
      // Upsert all aliases
      if (aliasInserts.length > 0) {
        for (const alias of aliasInserts) {
          await supabase.from('hotel_aliases').upsert(alias, { onConflict: 'property_id,source' });
        }
        console.log(`[resolve] Saved ${aliasInserts.length} aliases for ${property.name}`);
      }

      // Return updated property with new URLs
      const updatedProperty: Property = {
        ...property,
        booking_url: urls.booking_url || property.booking_url,
        tripadvisor_url: urls.tripadvisor_url || property.tripadvisor_url,
        expedia_url: urls.expedia_url || property.expedia_url,
      };

      return { success: true, hotelIds, updatedProperty };
    } catch (err) {
      console.error('URL resolution error:', err);
      return { success: false };
    }
  }, []);

  // Check if property needs URL resolution - returns false if already resolved
  const needsUrlResolution = useCallback(async (property: Property, platform: Platform): Promise<boolean> => {
    if (platform === 'google') return false; // Google uses Places API, not URLs
    
    // Check if alias exists for this platform with resolved status
    const { data: alias } = await supabase
      .from('hotel_aliases')
      .select('platform_url, platform_id, resolution_status')
      .eq('property_id', property.id)
      .eq('source', platform)
      .maybeSingle();

    // No alias = needs resolution
    if (!alias) return true;
    
    // Already resolved with URL/ID = no need to re-resolve
    if (alias.resolution_status === 'resolved') {
      if (platform === 'expedia' && alias.platform_id) {
        console.log(`[${platform}] ${property.name} already has hotel_id: ${alias.platform_id}`);
        return false;
      }
      if (alias.platform_url) {
        console.log(`[${platform}] ${property.name} already has URL: ${alias.platform_url}`);
        return false;
      }
    }
    
    // Not listed = don't try again
    if (alias.resolution_status === 'not_listed') return false;
    
    return true;
  }, []);

  // STEP 2: Fetch rating for a single platform
  const fetchPlatformRating = useCallback(async (
    property: Property,
    platform: Platform,
    retryAttempt = 0
  ): Promise<{ success: boolean; error?: string; notListed?: boolean }> => {
    try {
      console.log(`[${platform}] Fetching ${property.name} (attempt ${retryAttempt + 1})`);
      
      // For OTA platforms, fetch fresh URLs from database to ensure we have latest
      let startUrl: string | null = null;
      if (platform !== 'google' && platform !== 'expedia') {
        const { data: freshProperty } = await supabase
          .from('properties')
          .select(`${platform}_url`)
          .eq('id', property.id)
          .single();
        
        startUrl = freshProperty?.[`${platform}_url`] as string | null || null;
        console.log(`[${platform}] ${property.name} using URL: ${startUrl || 'none'}`);
      }
      
      // Build request body based on platform
      const body = platform === 'expedia' 
        ? { propertyId: property.id }
        : platform === 'google'
          ? { 
              hotelName: property.name, 
              city: `${property.city}, ${property.state}`,
              // Pass stored placeId for faster lookup (avoids search)
              placeId: property.google_place_id || null,
            }
          : {
              hotelName: property.name,
              city: `${property.city}, ${property.state}`,
              startUrl,
            };
      
      const { data, error } = await supabase.functions.invoke(PLATFORM_CONFIG[platform].functionName, {
        body,
      });

      if (error) {
        const isRetryable = error.message?.includes('timeout') || 
                           error.message?.includes('rate limit') || 
                           error.message?.includes('429');
        
        if (isRetryable && retryAttempt < MAX_RETRIES && platform !== 'google') {
          console.log(`[${platform}] ${property.name} failed, retrying...`);
          await delay(RETRY_DELAY_MS);
          return fetchPlatformRating(property, platform, retryAttempt + 1);
        }
        
        return { success: false, error: error.message || 'API error' };
      }

      // Handle Expedia response format
      if (platform === 'expedia') {
        if (data.status === 'no_alias' || data.status === 'no_hotel_id') {
          return { success: false, error: 'No hotel ID' };
        }
        if (data.status === 'not_listed') {
          return { success: true, notListed: true };
        }
        if (data.status === 'no_data') {
          return { success: true, notListed: true }; // Treat no_data as not listed
        }
        if (data.success && data.status === 'found') {
          console.log(`[${platform}] ${property.name} SUCCESS: ${data.rating}/10`);
          return { success: true };
        }
      }

      // Handle standard response format
      if (!data.found) {
        return { success: true, notListed: true };
      }

      // Save snapshot for non-Expedia platforms (Expedia saves internally)
      if (platform !== 'expedia' && data.rating !== null && data.rating !== undefined) {
        const scale = platform === 'google' ? 5 : (data.scale || 5);
        const normalizedScore = scale === 10 ? data.rating : (data.rating / scale) * 10;
        
        await supabase.from('source_snapshots').insert({
          property_id: property.id,
          source: platform,
          score_raw: data.rating,
          score_scale: scale,
          review_count: data.reviewCount || 0,
          normalized_score_0_10: parseFloat(normalizedScore.toFixed(2)),
        });

        // For Google, also save placeId and website URL to the property
        if (platform === 'google') {
          const updateData: Record<string, string | null> = {};
          if (data.placeId) updateData.google_place_id = data.placeId;
          if (data.websiteUrl) updateData.website_url = data.websiteUrl;
          
          if (Object.keys(updateData).length > 0) {
            await supabase.from('properties').update(updateData).eq('id', property.id);
            console.log(`[google] Saved placeId and/or websiteUrl for ${property.name}`);
          }
        }

        console.log(`[${platform}] ${property.name} SUCCESS: ${data.rating}/${scale}`);
      }

      return { success: true };
    } catch (err) {
      if (retryAttempt < MAX_RETRIES && platform !== 'google') {
        await delay(RETRY_DELAY_MS);
        return fetchPlatformRating(property, platform, retryAttempt + 1);
      }
      return { success: false, error: 'Unexpected error' };
    }
  }, []);

  // UNIFIED REFRESH: Single property, single platform
  const refreshSingleCell = useCallback(async (property: Property, platform: Platform) => {
    setIsRunning(true);
    setCurrentPhase('resolving');
    setCurrentPlatform(platform);
    
    // Initialize state for this operation
    setPropertyStates([{
      property,
      phase: 'resolving',
      platforms: [{ platform, status: 'resolving' }],
    }]);

    try {
      // Step 1: Check if we need URL resolution
      const needsResolve = await needsUrlResolution(property, platform);
      let currentProperty = property;
      
      if (needsResolve) {
        console.log(`[${platform}] ${property.name} needs URL resolution`);
        updatePlatformStatus(property.id, platform, 'resolving');
        const resolveResult = await resolvePropertyUrls(property, [platform]);
        if (resolveResult.updatedProperty) {
          currentProperty = resolveResult.updatedProperty;
        }
        await delay(1000); // Brief pause after resolution
      } else {
        console.log(`[${platform}] ${property.name} using cached URL, skipping resolution`);
      }

      // Step 2: Fetch the rating
      setCurrentPhase('fetching');
      updatePropertyPhase(property.id, 'fetching');
      updatePlatformStatus(property.id, platform, 'fetching');

      // Use the updated property with resolved URLs
      const result = await fetchPlatformRating(currentProperty, platform);

      if (result.notListed) {
        updatePlatformStatus(property.id, platform, 'not_listed');
        toast({
          title: 'Not listed',
          description: `${property.name} not found on ${PLATFORM_CONFIG[platform].displayName}`,
        });
      } else if (result.success) {
        updatePlatformStatus(property.id, platform, 'complete');
        toast({
          title: 'Rating updated',
          description: `${property.name} - ${PLATFORM_CONFIG[platform].displayName}`,
        });
      } else {
        updatePlatformStatus(property.id, platform, 'failed', result.error);
        toast({
          variant: 'destructive',
          title: 'Refresh failed',
          description: result.error || 'Unknown error',
        });
      }

      updatePropertyPhase(property.id, 'complete');
      queryClient.invalidateQueries({ queryKey: ['latest-scores'] });
    } finally {
      setIsRunning(false);
      setIsComplete(true);
      setCurrentPhase('complete');
      setCurrentPlatform(null);
    }
  }, [needsUrlResolution, resolvePropertyUrls, fetchPlatformRating, updatePropertyPhase, updatePlatformStatus, queryClient, toast]);

  // UNIFIED REFRESH: Single property, all platforms
  const refreshSingleRow = useCallback(async (property: Property) => {
    const platforms: Platform[] = ['google', 'tripadvisor', 'booking', 'expedia'];
    
    setIsRunning(true);
    setCurrentPhase('resolving');
    dialogOpenRef.current = true;
    
    // Initialize state
    setPropertyStates([{
      property,
      phase: 'resolving',
      platforms: platforms.map(p => ({ platform: p, status: 'queued' })),
    }]);

    try {
      // Step 1: Check which platforms need URL resolution
      console.log(`=== Refreshing all platforms for ${property.name} ===`);
      updatePropertyPhase(property.id, 'resolving');
      
      const platformsNeedingResolution: Platform[] = [];
      for (const platform of ['tripadvisor', 'booking', 'expedia'] as Platform[]) {
        const needsResolve = await needsUrlResolution(property, platform);
        if (needsResolve) {
          platformsNeedingResolution.push(platform);
          updatePlatformStatus(property.id, platform, 'resolving');
        }
      }

      // Only resolve if at least one platform needs it
      let currentProperty = property;
      if (platformsNeedingResolution.length > 0) {
        console.log(`[resolve] ${property.name} needs resolution for: ${platformsNeedingResolution.join(', ')}`);
        const resolveResult = await resolvePropertyUrls(property, platformsNeedingResolution);
        currentProperty = resolveResult.updatedProperty || property;
        await delay(1500);
      } else {
        console.log(`[resolve] ${property.name} has all URLs cached, skipping resolution`);
      }

      // Step 2: Fetch all platforms
      setCurrentPhase('fetching');
      updatePropertyPhase(property.id, 'fetching');

      let successCount = 0;
      let notListedCount = 0;
      let failedCount = 0;

      for (const platform of platforms) {
        setCurrentPlatform(platform);
        updatePlatformStatus(property.id, platform, 'fetching');

        // Use the updated property with resolved URLs
        const result = await fetchPlatformRating(currentProperty, platform);

        if (result.notListed) {
          notListedCount++;
          updatePlatformStatus(property.id, platform, 'not_listed');
        } else if (result.success) {
          successCount++;
          updatePlatformStatus(property.id, platform, 'complete');
        } else {
          failedCount++;
          updatePlatformStatus(property.id, platform, 'failed', result.error);
        }

        queryClient.invalidateQueries({ queryKey: ['latest-scores'] });

        if (platforms.indexOf(platform) < platforms.length - 1) {
          await delay(DELAY_BETWEEN_CALLS_MS);
        }
      }

      updatePropertyPhase(property.id, 'complete');
      
      toast({
        title: 'Refresh complete',
        description: `${property.name}: ${successCount} found, ${notListedCount} not listed, ${failedCount} failed`,
      });

      // Auto-fetch insights in the background (non-blocking)
      if (successCount > 0) {
        fetchInsightsForProperty(currentProperty, queryClient).catch(err => {
          console.warn(`[auto-insights] ${property.name} failed:`, err);
        });
      }
    } finally {
      setIsRunning(false);
      setIsComplete(true);
      setCurrentPhase('complete');
      setCurrentPlatform(null);
    }
  }, [needsUrlResolution, resolvePropertyUrls, fetchPlatformRating, updatePropertyPhase, updatePlatformStatus, queryClient, toast]);

  // UNIFIED REFRESH: All properties, all platforms
  const refreshAll = useCallback(async (
    properties: Property[],
    platforms: Platform[] = ['google', 'tripadvisor', 'booking', 'expedia']
  ) => {
    if (properties.length === 0) return;

    setIsRunning(true);
    setIsComplete(false);
    setCurrentPhase('resolving');
    dialogOpenRef.current = true;

    console.log(`=== Starting unified refresh for ${properties.length} properties ===`);

    // Initialize states
    const initialStates: PropertyRefreshState[] = properties.map(property => ({
      property,
      phase: 'resolving',
      platforms: platforms.map(platform => ({ platform, status: 'queued' })),
    }));
    setPropertyStates(initialStates);

    let totalSuccess = 0;
    let totalNotListed = 0;
    let totalFailed = 0;

    // Map to store updated properties with resolved URLs
    const updatedPropertiesMap = new Map<string, Property>();

    // Step 1: Resolve URLs for all properties (batch)
    console.log(`\n--- Phase 1: Resolving URLs ---`);
    for (const property of properties) {
      updatePropertyPhase(property.id, 'resolving');
      
      // Check which platforms need resolution
      const otaPlatforms = ['tripadvisor', 'booking', 'expedia'] as Platform[];
      const needsResolution = await Promise.all(
        otaPlatforms.map(p => needsUrlResolution(property, p))
      );
      
      const platformsToResolve = otaPlatforms.filter((_, i) => needsResolution[i]);
      
      if (platformsToResolve.length > 0) {
        console.log(`[resolve] ${property.name} needs resolution for: ${platformsToResolve.join(', ')}`);
        for (const platform of platformsToResolve) {
          updatePlatformStatus(property.id, platform, 'resolving');
        }
        const resolveResult = await resolvePropertyUrls(property, platformsToResolve);
        if (resolveResult.updatedProperty) {
          updatedPropertiesMap.set(property.id, resolveResult.updatedProperty);
        }
      } else {
        console.log(`[resolve] ${property.name} has all URLs cached, skipping resolution`);
      }
      
      // Brief delay between properties during resolution
      await delay(2000);
    }

    // Step 2: Fetch ratings platform by platform
    setCurrentPhase('fetching');
    console.log(`\n--- Phase 2: Fetching ratings ---`);

    for (const platform of platforms) {
      setCurrentPlatform(platform);
      console.log(`\n--- Processing platform: ${platform} ---`);

      for (let i = 0; i < properties.length; i++) {
        const property = properties[i];
        // Use updated property with resolved URLs if available
        const currentProperty = updatedPropertiesMap.get(property.id) || property;
        
        updatePropertyPhase(property.id, 'fetching');
        updatePlatformStatus(property.id, platform, 'fetching');

        const result = await fetchPlatformRating(currentProperty, platform);

        if (result.notListed) {
          totalNotListed++;
          updatePlatformStatus(property.id, platform, 'not_listed');
        } else if (result.success) {
          totalSuccess++;
          updatePlatformStatus(property.id, platform, 'complete');
        } else {
          totalFailed++;
          updatePlatformStatus(property.id, platform, 'failed', result.error);
        }

        queryClient.invalidateQueries({ queryKey: ['latest-scores'] });

        // Delay between calls
        if (i < properties.length - 1 || platforms.indexOf(platform) < platforms.length - 1) {
          await delay(DELAY_BETWEEN_CALLS_MS);
        }
      }
    }

    // Mark all as complete
    for (const property of properties) {
      updatePropertyPhase(property.id, 'complete');
    }

    console.log(`\n=== Refresh complete: ${totalSuccess} success, ${totalNotListed} not listed, ${totalFailed} failed ===`);

    setCurrentPlatform(null);
    setIsRunning(false);
    setIsComplete(true);
    setCurrentPhase('complete');

    queryClient.invalidateQueries({ queryKey: ['property-snapshots'] });
    queryClient.invalidateQueries({ queryKey: ['google-trends'] });
    queryClient.invalidateQueries({ queryKey: ['ota-trends'] });

    if (!dialogOpenRef.current) {
      toast({
        title: 'Refresh complete',
        description: `${totalSuccess} found, ${totalNotListed} not listed, ${totalFailed} failed`,
      });
    }
  }, [needsUrlResolution, resolvePropertyUrls, fetchPlatformRating, updatePropertyPhase, updatePlatformStatus, queryClient, toast]);

  // Retry a single failed platform
  const retryPlatform = useCallback(async (property: Property, platform: Platform) => {
    await refreshSingleCell(property, platform);
  }, [refreshSingleCell]);

  // Retry all failed operations
  const retryAllFailed = useCallback(async () => {
    const failedItems: { property: Property; platform: Platform }[] = [];
    
    propertyStates.forEach(({ property, platforms }) => {
      platforms.forEach(({ platform, status }) => {
        if (status === 'failed') {
          failedItems.push({ property, platform });
        }
      });
    });

    if (failedItems.length === 0) {
      toast({ title: 'No failed items', description: 'Nothing to retry.' });
      return;
    }

    setIsRunning(true);
    setIsComplete(false);
    setCurrentPhase('fetching');

    let retrySuccess = 0;
    let retryFailed = 0;

    for (const { property, platform } of failedItems) {
      updatePlatformStatus(property.id, platform, 'fetching');
      
      const result = await fetchPlatformRating(property, platform);
      
      if (result.notListed || result.success) {
        retrySuccess++;
        updatePlatformStatus(property.id, platform, result.notListed ? 'not_listed' : 'complete');
      } else {
        retryFailed++;
        updatePlatformStatus(property.id, platform, 'failed', result.error);
      }

      await delay(DELAY_BETWEEN_CALLS_MS);
    }

    setIsRunning(false);
    setIsComplete(true);
    setCurrentPhase('complete');

    queryClient.invalidateQueries({ queryKey: ['latest-scores'] });

    toast({
      title: 'Retry complete',
      description: `${retrySuccess} succeeded, ${retryFailed} still failed`,
    });
  }, [propertyStates, fetchPlatformRating, updatePlatformStatus, queryClient, toast]);

  const getFailedCount = useCallback(() => {
    return propertyStates.reduce(
      (sum, p) => sum + p.platforms.filter(pl => pl.status === 'failed').length,
      0
    );
  }, [propertyStates]);

  const setDialogOpen = useCallback((open: boolean) => {
    dialogOpenRef.current = open;
  }, []);

  const reset = useCallback(() => {
    setPropertyStates([]);
    setIsRunning(false);
    setIsComplete(false);
    setCurrentPhase('idle');
    setCurrentPlatform(null);
  }, []);

  return {
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
    reset,
  };
}
