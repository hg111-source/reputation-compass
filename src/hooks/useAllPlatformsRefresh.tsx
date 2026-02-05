import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export type Platform = 'google' | 'tripadvisor' | 'booking' | 'expedia';
export type RefreshStatus = 'queued' | 'in_progress' | 'complete' | 'failed' | 'not_listed';

export interface PlatformRefreshState {
  platform: Platform;
  status: RefreshStatus;
  error?: string;
  startedAt?: number;
  retryCount?: number;
}

export interface PropertyPlatformState {
  property: Property;
  platforms: PlatformRefreshState[];
}

// Increased delay to 5 seconds to avoid rate limiting
const DELAY_BETWEEN_CALLS_MS = 5000;
const RETRY_DELAY_MS = 10000;
const MAX_RETRIES = 1;

const PLATFORM_CONFIG: Record<Platform, { displayName: string; scale: number }> = {
  google: { displayName: 'Google', scale: 5 },
  tripadvisor: { displayName: 'TripAdvisor', scale: 5 },
  booking: { displayName: 'Booking.com', scale: 10 },
  expedia: { displayName: 'Expedia', scale: 10 },
};

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function useAllPlatformsRefresh() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [currentPlatform, setCurrentPlatform] = useState<Platform | null>(null);
  const [propertyStates, setPropertyStates] = useState<PropertyPlatformState[]>([]);
  const dialogOpenRef = useRef(true);

  const updatePlatformStatus = useCallback((
    propertyId: string,
    platform: Platform,
    status: RefreshStatus,
    error?: string,
    startedAt?: number,
    retryCount?: number
  ) => {
    setPropertyStates(prev =>
      prev.map(p =>
        p.property.id === propertyId
          ? {
              ...p,
              platforms: p.platforms.map(pl =>
                pl.platform === platform ? { ...pl, status, error, startedAt, retryCount } : pl
              ),
            }
          : p
      )
    );
  }, []);

  const fetchSinglePlatform = useCallback(async (
    property: Property,
    platform: Platform,
    retryAttempt = 0
  ): Promise<{ success: boolean; error?: string; notListed?: boolean }> => {
    try {
      console.log(`[${platform}] Fetching ${property.name} (attempt ${retryAttempt + 1})`);
      
      // Use the unified fetch-rating-by-alias function
      const { data, error } = await supabase.functions.invoke('fetch-rating-by-alias', {
        body: {
          propertyId: property.id,
          source: platform,
        },
      });

      if (error) {
        const isRetryable = error.message?.includes('timeout') || 
                           error.message?.includes('rate limit') || 
                           error.message?.includes('429') ||
                           error.message?.includes('TIMED-OUT');
        
        // Retry logic for Apify platforms (booking, expedia, tripadvisor)
        if (isRetryable && retryAttempt < MAX_RETRIES && platform !== 'google') {
          console.log(`[${platform}] ${property.name} failed, retrying in ${RETRY_DELAY_MS/1000}s...`);
          await delay(RETRY_DELAY_MS);
          return fetchSinglePlatform(property, platform, retryAttempt + 1);
        }
        
        const msg = error.message?.includes('rate limit') || error.message?.includes('429')
          ? 'Rate limit reached'
          : error.message?.includes('timeout') || error.message?.includes('TIMED-OUT')
            ? 'Timeout'
            : error.message || 'API error';
        console.log(`[${platform}] ${property.name} FAILED: ${msg}`);
        return { success: false, error: msg };
      }

      // Handle response from fetch-rating-by-alias
      if (!data.success) {
        // Check specific statuses
        if (data.status === 'not_listed') {
          console.log(`[${platform}] ${property.name} NOT LISTED`);
          return { success: true, notListed: true };
        }
        
        if (data.status === 'no_alias') {
          console.log(`[${platform}] ${property.name} NO ALIAS - run resolve-identity first`);
          return { success: false, error: 'No identity resolved' };
        }
        
        if (data.status === 'needs_review') {
          console.log(`[${platform}] ${property.name} NEEDS REVIEW`);
          return { success: false, error: 'Needs manual review' };
        }
        
        // Retry on Apify errors
        if (retryAttempt < MAX_RETRIES && platform !== 'google' && 
            (data.error?.includes('timeout') || data.error?.includes('TIMEOUT') || data.status === 'timeout')) {
          console.log(`[${platform}] ${property.name} timeout, retrying in ${RETRY_DELAY_MS/1000}s...`);
          await delay(RETRY_DELAY_MS);
          return fetchSinglePlatform(property, platform, retryAttempt + 1);
        }
        
        console.log(`[${platform}] ${property.name} FAILED: ${data.error || data.status}`);
        return { success: false, error: data.error || data.status };
      }

      // Success - snapshot is already saved by the edge function
      if (data.rating !== null && data.rating !== undefined) {
        console.log(`[${platform}] ${property.name} SUCCESS: ${data.rating}/${data.scale} (${data.reviewCount} reviews)`);
      }

      console.log(`[${platform}] ${property.name} SUCCESS`);
      return { success: true };
    } catch (err) {
      // Retry on unexpected errors for Apify platforms
      if (retryAttempt < MAX_RETRIES && platform !== 'google') {
        console.log(`[${platform}] ${property.name} unexpected error, retrying in ${RETRY_DELAY_MS/1000}s...`);
        await delay(RETRY_DELAY_MS);
        return fetchSinglePlatform(property, platform, retryAttempt + 1);
      }
      console.log(`[${platform}] ${property.name} FAILED: Unexpected error`);
      return { success: false, error: 'Unexpected error' };
    }
  }, []);

  const startAllPlatformsRefresh = useCallback(async (
    properties: Property[],
    platforms: Platform[] = ['google', 'tripadvisor', 'booking', 'expedia']
  ) => {
    if (properties.length === 0) return;

    setIsRunning(true);
    setIsComplete(false);
    dialogOpenRef.current = true;

    console.log(`=== Starting refresh for ${properties.length} properties, ${platforms.length} platforms ===`);

    // Initialize states
    const initialStates: PropertyPlatformState[] = properties.map(property => ({
      property,
      platforms: platforms.map(platform => ({
        platform,
        status: 'queued' as RefreshStatus,
        retryCount: 0,
      })),
    }));
    setPropertyStates(initialStates);

    let totalSuccess = 0;
    let totalFailure = 0;
    let totalNotListed = 0;

    // Process platform by platform, one hotel at a time (sequential)
    for (const platform of platforms) {
      setCurrentPlatform(platform);
      console.log(`\n--- Processing platform: ${platform} ---`);

      for (let i = 0; i < properties.length; i++) {
        const property = properties[i];
        
        updatePlatformStatus(property.id, platform, 'in_progress', undefined, Date.now());
        
        const result = await fetchSinglePlatform(property, platform);
        
        if (result.notListed) {
          totalNotListed++;
          updatePlatformStatus(property.id, platform, 'not_listed');
        } else if (result.success) {
          totalSuccess++;
          updatePlatformStatus(property.id, platform, 'complete');
        } else {
          totalFailure++;
          updatePlatformStatus(property.id, platform, 'failed', result.error);
        }

        // Invalidate queries after each fetch
        queryClient.invalidateQueries({ queryKey: ['latest-scores'] });

        // Delay between calls (5 seconds)
        if (i < properties.length - 1 || platforms.indexOf(platform) < platforms.length - 1) {
          await delay(DELAY_BETWEEN_CALLS_MS);
        }
      }
    }

    console.log(`\n=== Refresh complete: ${totalSuccess} success, ${totalNotListed} not listed, ${totalFailure} failed ===`);

    setCurrentPlatform(null);
    setIsRunning(false);
    setIsComplete(true);

    queryClient.invalidateQueries({ queryKey: ['property-snapshots'] });
    queryClient.invalidateQueries({ queryKey: ['google-trends'] });
    queryClient.invalidateQueries({ queryKey: ['ota-trends'] });

    if (!dialogOpenRef.current) {
      toast({
        title: 'All platforms refresh complete',
        description: `${totalSuccess} found, ${totalNotListed} not listed, ${totalFailure} failed`,
      });
    }
  }, [fetchSinglePlatform, queryClient, updatePlatformStatus, toast]);

  const retryPlatform = useCallback(async (property: Property, platform: Platform) => {
    updatePlatformStatus(property.id, platform, 'in_progress', undefined, Date.now());
    
    const result = await fetchSinglePlatform(property, platform);
    
    if (result.notListed) {
      updatePlatformStatus(property.id, platform, 'not_listed');
      toast({
        title: 'Hotel not listed',
        description: `${property.name} is not listed on ${PLATFORM_CONFIG[platform].displayName}`,
      });
    } else if (result.success) {
      updatePlatformStatus(property.id, platform, 'complete');
      toast({
        title: 'Retry successful',
        description: `${property.name} - ${PLATFORM_CONFIG[platform].displayName} updated`,
      });
    } else {
      updatePlatformStatus(property.id, platform, 'failed', result.error);
      toast({
        variant: 'destructive',
        title: 'Retry failed',
        description: result.error || 'Unknown error',
      });
    }

    queryClient.invalidateQueries({ queryKey: ['property-snapshots'] });
    queryClient.invalidateQueries({ queryKey: ['latest-scores'] });
  }, [fetchSinglePlatform, queryClient, updatePlatformStatus, toast]);

  // Retry all failed operations
  const retryAllFailed = useCallback(async () => {
    const failedItems: { property: Property; platform: Platform }[] = [];
    
    // Collect all failed items
    propertyStates.forEach(({ property, platforms }) => {
      platforms.forEach(({ platform, status }) => {
        if (status === 'failed') {
          failedItems.push({ property, platform });
        }
      });
    });

    if (failedItems.length === 0) {
      toast({
        title: 'No failed items',
        description: 'There are no failed operations to retry.',
      });
      return;
    }

    setIsRunning(true);
    setIsComplete(false);

    console.log(`\n=== Retrying ${failedItems.length} failed operations ===`);

    let retrySuccess = 0;
    let retryFailed = 0;

    for (let i = 0; i < failedItems.length; i++) {
      const { property, platform } = failedItems[i];
      
      updatePlatformStatus(property.id, platform, 'in_progress', undefined, Date.now());
      
      const result = await fetchSinglePlatform(property, platform);
      
      if (result.notListed) {
        updatePlatformStatus(property.id, platform, 'not_listed');
        retrySuccess++;
      } else if (result.success) {
        updatePlatformStatus(property.id, platform, 'complete');
        retrySuccess++;
      } else {
        updatePlatformStatus(property.id, platform, 'failed', result.error);
        retryFailed++;
      }

      // Delay between retries
      if (i < failedItems.length - 1) {
        await delay(DELAY_BETWEEN_CALLS_MS);
      }
    }

    console.log(`\n=== Retry complete: ${retrySuccess} succeeded, ${retryFailed} still failed ===`);

    setIsRunning(false);
    setIsComplete(true);

    queryClient.invalidateQueries({ queryKey: ['property-snapshots'] });
    queryClient.invalidateQueries({ queryKey: ['latest-scores'] });

    toast({
      title: 'Retry complete',
      description: `${retrySuccess} succeeded, ${retryFailed} still failed`,
    });
  }, [propertyStates, fetchSinglePlatform, queryClient, updatePlatformStatus, toast]);

  // Get count of failed operations
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
    setCurrentPlatform(null);
  }, []);

  return {
    isRunning,
    isComplete,
    currentPlatform,
    propertyStates,
    startAllPlatformsRefresh,
    retryPlatform,
    retryAllFailed,
    getFailedCount,
    setDialogOpen,
    reset,
  };
}
