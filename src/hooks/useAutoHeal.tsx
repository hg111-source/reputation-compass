import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/lib/types';
import { Platform } from '@/hooks/useUnifiedRefresh';
import { toast } from 'sonner';

const MAX_RETRIES = 3;
const BATCH_SIZE = 3;
const DELAY_BETWEEN_BATCHES_MS = 5000;
const RETRY_DELAY_MS = 10000;

export interface HealingItem {
  propertyId: string;
  propertyName: string;
  platform: Platform;
  status: 'queued' | 'retrying' | 'resolved' | 'failed';
  retryCount: number;
  error?: string;
}

export interface HealingProgress {
  total: number;
  resolved: number;
  failed: number;
  inProgress: number;
  items: HealingItem[];
}

const PLATFORM_CONFIG: Record<Platform, { functionName: string; scale: number }> = {
  google: { functionName: 'fetch-place-rating', scale: 5 },
  tripadvisor: { functionName: 'fetch-tripadvisor-rating', scale: 5 },
  booking: { functionName: 'fetch-booking-rating', scale: 10 },
  expedia: { functionName: 'fetch-expedia-rating', scale: 10 },
};

async function logDebug(
  propertyId: string,
  platform: string,
  errorMessage: string,
  retryCount: number,
  status: string
) {
  try {
    await supabase.from('debug_logs').upsert(
      {
        property_id: propertyId,
        platform,
        error_message: errorMessage,
        retry_count: retryCount,
        status,
      },
      { onConflict: 'property_id,platform', ignoreDuplicates: false }
    );
  } catch (e) {
    // debug logging should never break the main flow
    console.warn('Failed to write debug log:', e);
  }
}

export function useAutoHeal(
  properties: Property[],
  scores: Record<string, Record<string, { score: number | null; count: number; updated: string; status?: string }> | undefined>,
  enabled: boolean = true
) {
  const queryClient = useQueryClient();
  const hasRun = useRef(false);
  const [progress, setProgress] = useState<HealingProgress | null>(null);
  const [isHealing, setIsHealing] = useState(false);

  // Detect missing scores
  const detectMissing = useCallback((): HealingItem[] => {
    const missing: HealingItem[] = [];
    const platforms: Platform[] = ['google', 'tripadvisor', 'booking', 'expedia'];

    for (const property of properties) {
      const propertyScores = scores[property.id];
      for (const platform of platforms) {
        const platformData = propertyScores?.[platform];
        // Missing if no data at all, or score is null
        if (!platformData || platformData.score === null || platformData.score === undefined) {
          // Skip if status is 'not_listed' — that's intentional
          if (platformData?.status === 'not_listed') continue;
          
          missing.push({
            propertyId: property.id,
            propertyName: property.name,
            platform,
            status: 'queued',
            retryCount: 0,
          });
        }
      }
    }

    return missing;
  }, [properties, scores]);

  // Fetch a single platform rating
  const fetchRating = useCallback(async (
    property: Property,
    platform: Platform
  ): Promise<{ success: boolean; notListed?: boolean; error?: string }> => {
    try {
      // For OTA platforms, get the URL from the database
      let startUrl: string | null = null;
      if (platform !== 'google' && platform !== 'expedia') {
        const { data: freshProp } = await supabase
          .from('properties')
          .select(`${platform}_url`)
          .eq('id', property.id)
          .single();
        startUrl = freshProp?.[`${platform}_url`] as string | null || null;
        
        // If no URL, try to resolve first
        if (!startUrl) {
          const { data: resolveData, error: resolveError } = await supabase.functions.invoke('resolve-hotel-urls', {
            body: {
              hotelName: property.name,
              city: property.city,
              state: property.state,
              platforms: [platform],
            },
          });
          
          if (!resolveError && resolveData?.urls?.[`${platform}_url`]) {
            startUrl = resolveData.urls[`${platform}_url`];
            // Save the URL
            await supabase.from('properties').update({ [`${platform}_url`]: startUrl }).eq('id', property.id);
            // Save alias
            await supabase.from('hotel_aliases').upsert({
              property_id: property.id,
              source: platform,
              platform_url: startUrl,
              source_id_or_url: startUrl,
              resolution_status: 'resolved',
              last_resolved_at: new Date().toISOString(),
            }, { onConflict: 'property_id,source' });
          }
        }
      }

      // Build request body
      const body = platform === 'expedia'
        ? { propertyId: property.id }
        : platform === 'google'
          ? { hotelName: property.name, city: `${property.city}, ${property.state}`, placeId: property.google_place_id }
          : { hotelName: property.name, city: `${property.city}, ${property.state}`, startUrl };

      const { data, error } = await supabase.functions.invoke(PLATFORM_CONFIG[platform].functionName, { body });

      if (error) {
        return { success: false, error: error.message || 'Edge function error' };
      }

      // Handle Expedia
      if (platform === 'expedia') {
        if (data.status === 'no_alias' || data.status === 'no_hotel_id') return { success: false, error: 'No hotel ID' };
        if (data.status === 'not_listed' || data.status === 'no_data') return { success: true, notListed: true };
        if (data.success && data.status === 'found') return { success: true };
      }

      if (!data.found) return { success: true, notListed: true };

      // Save snapshot for non-Expedia
      if (platform !== 'expedia' && data.rating != null) {
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

        if (platform === 'google') {
          const updates: Record<string, string | null> = {};
          if (data.placeId) updates.google_place_id = data.placeId;
          if (data.websiteUrl) updates.website_url = data.websiteUrl;
          if (Object.keys(updates).length > 0) {
            await supabase.from('properties').update(updates).eq('id', property.id);
          }
        }
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, []);

  // Process the healing queue
  const processQueue = useCallback(async (items: HealingItem[]) => {
    if (items.length === 0) return;

    setIsHealing(true);
    const workingItems = [...items];
    let resolvedCount = 0;
    let failedCount = 0;

    setProgress({
      total: workingItems.length,
      resolved: 0,
      failed: 0,
      inProgress: 0,
      items: workingItems,
    });

    // Process in batches
    for (let batchStart = 0; batchStart < workingItems.length; batchStart += BATCH_SIZE) {
      const batch = workingItems.slice(batchStart, batchStart + BATCH_SIZE);

      // Process batch items sequentially (to avoid rate limits)
      for (const item of batch) {
        const property = properties.find(p => p.id === item.propertyId);
        if (!property) {
          item.status = 'failed';
          item.error = 'Property not found';
          failedCount++;
          continue;
        }

        item.status = 'retrying';
        setProgress(prev => prev ? { ...prev, inProgress: prev.inProgress + 1, items: [...workingItems] } : null);

        let success = false;
        let lastError = '';

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          item.retryCount = attempt + 1;
          
          const result = await fetchRating(property, item.platform);

          if (result.success) {
            if (result.notListed) {
              // Record as not_listed snapshot so we don't retry
              await supabase.from('source_snapshots').insert({
                property_id: property.id,
                source: item.platform,
                score_raw: null,
                score_scale: null,
                review_count: 0,
                normalized_score_0_10: null,
                status: 'not_listed',
              });
            }
            success = true;
            item.status = 'resolved';
            resolvedCount++;
            await logDebug(property.id, item.platform, 'Resolved successfully', attempt + 1, 'resolved');
            break;
          }

          lastError = result.error || 'Unknown error';
          console.log(`[auto-heal] ${property.name}/${item.platform} attempt ${attempt + 1} failed: ${lastError}`);

          if (attempt < MAX_RETRIES - 1) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          }
        }

        if (!success) {
          item.status = 'failed';
          item.error = lastError;
          failedCount++;
          await logDebug(property.id, item.platform, lastError, MAX_RETRIES, 'failed');
        }

        setProgress({
          total: workingItems.length,
          resolved: resolvedCount,
          failed: failedCount,
          inProgress: workingItems.filter(i => i.status === 'retrying').length,
          items: [...workingItems],
        });
      }

      // Invalidate queries after each batch so UI updates
      queryClient.invalidateQueries({ queryKey: ['latest-scores'] });

      // Delay between batches
      if (batchStart + BATCH_SIZE < workingItems.length) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    // Final invalidation
    queryClient.invalidateQueries({ queryKey: ['latest-scores'] });
    queryClient.invalidateQueries({ queryKey: ['property-snapshots'] });

    setIsHealing(false);

    if (resolvedCount > 0) {
      toast.success(`Auto-heal recovered ${resolvedCount} missing score${resolvedCount > 1 ? 's' : ''}`);
    }

    setProgress({
      total: workingItems.length,
      resolved: resolvedCount,
      failed: failedCount,
      inProgress: 0,
      items: workingItems,
    });
  }, [properties, fetchRating, queryClient]);

  // Run on first load only
  useEffect(() => {
    if (!enabled || hasRun.current || properties.length === 0 || Object.keys(scores).length === 0) return;
    hasRun.current = true;

    const missing = detectMissing();
    if (missing.length === 0) return;

    console.log(`[auto-heal] Detected ${missing.length} missing scores, starting healing...`);
    processQueue(missing);
  }, [enabled, properties, scores, detectMissing, processQueue]);

  // Expose healing items for status indicators
  const getItemStatus = useCallback((propertyId: string, platform: Platform): HealingItem | undefined => {
    return progress?.items.find(i => i.propertyId === propertyId && i.platform === platform);
  }, [progress]);

  return {
    isHealing,
    progress,
    getItemStatus,
  };
}
