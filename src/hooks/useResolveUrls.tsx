import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/lib/types';
import { toast } from 'sonner';

export type ResolveStatus = 'idle' | 'resolving' | 'complete' | 'error';

export interface PropertyResolveState {
  property: Property;
  status: ResolveStatus;
  foundPlatforms: string[];
  notFoundPlatforms: string[];
  error?: string;
}

export interface BulkResolveProgress {
  current: number;
  total: number;
  currentProperty?: string;
  results: PropertyResolveState[];
}

export function useResolveUrls() {
  const [isResolving, setIsResolving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkResolveProgress | null>(null);

  const resolvePropertyUrls = useCallback(async (property: Property): Promise<PropertyResolveState> => {
    try {
      const { data, error } = await supabase.functions.invoke('resolve-hotel-urls', {
        body: {
          hotelName: property.name,
          city: property.city,
          state: property.state,
          platforms: ['booking', 'tripadvisor', 'expedia'],
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Update the property with the found URLs (client-side)
      const urls = data.urls || {};
      const hotelIds = data.hotelIds || {};
      const updateData: Record<string, string | null> = {};
      
      if (urls.booking_url !== undefined) updateData.booking_url = urls.booking_url;
      if (urls.tripadvisor_url !== undefined) updateData.tripadvisor_url = urls.tripadvisor_url;
      if (urls.expedia_url !== undefined) updateData.expedia_url = urls.expedia_url;

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('properties')
          .update(updateData)
          .eq('id', property.id);

        if (updateError) {
          console.error('Failed to update property URLs:', updateError);
        }
      }

      // Store Hotels.com hotel_id in hotel_aliases for expedia source
      if (urls.expedia_url && hotelIds.expedia_hotel_id) {
        const { error: aliasError } = await supabase
          .from('hotel_aliases')
          .upsert({
            property_id: property.id,
            source: 'expedia' as const,
            platform_url: urls.expedia_url,
            platform_id: hotelIds.expedia_hotel_id,
            source_id_or_url: urls.expedia_url,
            resolution_status: 'resolved',
            last_resolved_at: new Date().toISOString(),
          }, { onConflict: 'property_id,source' });

        if (aliasError) {
          console.error('Failed to update hotel alias:', aliasError);
        } else {
          console.log(`Stored Hotels.com hotel_id ${hotelIds.expedia_hotel_id} for ${property.name}`);
        }
      }

      return {
        property,
        status: 'complete',
        foundPlatforms: data.found || [],
        notFoundPlatforms: data.notFound || [],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return {
        property,
        status: 'error',
        foundPlatforms: [],
        notFoundPlatforms: ['booking', 'tripadvisor', 'expedia'],
        error: errorMessage,
      };
    }
  }, []);

  const resolveSingleProperty = useCallback(async (property: Property) => {
    setIsResolving(true);
    toast.info(`Finding URLs for ${property.name}...`);

    const result = await resolvePropertyUrls(property);

    setIsResolving(false);

    if (result.status === 'complete') {
      const foundCount = result.foundPlatforms.length;
      if (foundCount > 0) {
        toast.success(`Found ${foundCount} platform URL${foundCount > 1 ? 's' : ''} for ${property.name}`);
      } else {
        toast.warning(`No platform URLs found for ${property.name}`);
      }
    } else {
      toast.error(`Failed to resolve URLs: ${result.error}`);
    }

    return result;
  }, [resolvePropertyUrls]);

  const resolveAllProperties = useCallback(async (properties: Property[]) => {
    if (properties.length === 0) {
      toast.warning('No properties to resolve');
      return [];
    }

    setIsResolving(true);
    const results: PropertyResolveState[] = [];

    setBulkProgress({
      current: 0,
      total: properties.length,
      results: [],
    });

    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];

      setBulkProgress(prev => ({
        current: i,
        total: properties.length,
        currentProperty: property.name,
        results: prev?.results || [],
      }));

      const result = await resolvePropertyUrls(property);
      results.push(result);

      setBulkProgress(prev => ({
        current: i + 1,
        total: properties.length,
        currentProperty: property.name,
        results: [...(prev?.results || []), result],
      }));

      // 2-second delay between properties to avoid rate limiting
      if (i < properties.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setIsResolving(false);

    // Summary
    const totalFound = {
      booking: results.filter(r => r.foundPlatforms.includes('booking')).length,
      tripadvisor: results.filter(r => r.foundPlatforms.includes('tripadvisor')).length,
      expedia: results.filter(r => r.foundPlatforms.includes('expedia')).length,
    };

    toast.success(
      `URL Resolution Complete: Found ${totalFound.booking}/${properties.length} on Booking, ` +
      `${totalFound.tripadvisor}/${properties.length} on TripAdvisor, ` +
      `${totalFound.expedia}/${properties.length} on Expedia`
    );

    return results;
  }, [resolvePropertyUrls]);

  const clearProgress = useCallback(() => {
    setBulkProgress(null);
  }, []);

  return {
    isResolving,
    bulkProgress,
    resolveSingleProperty,
    resolveAllProperties,
    clearProgress,
  };
}
