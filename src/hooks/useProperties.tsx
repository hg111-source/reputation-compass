import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property, ReviewSource } from '@/lib/types';
import { useAuth } from './useAuth';
import { ParsedProperty } from '@/lib/csv';

export function useProperties() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: properties = [], isLoading, error } = useQuery({
    queryKey: ['properties', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Property[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const createProperty = useMutation({
    mutationFn: async (property: { name: string; city: string; state: string; google_place_id?: string | null; website_url?: string | null }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('properties')
        .insert({ 
          name: property.name,
          city: property.city,
          state: property.state,
          user_id: user.id,
          google_place_id: property.google_place_id || null,
          website_url: property.website_url || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Property;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });

  const createManyProperties = useMutation({
    mutationFn: async (props: ParsedProperty[]) => {
      if (!user) throw new Error('Not authenticated');
      
      // First, fetch existing properties to check for duplicates
      const { data: existingProps } = await supabase
        .from('properties')
        .select('id, name, city, state');
      
      const existingKeys = new Set(
        (existingProps || []).map(p => `${p.name.toLowerCase()}|${p.city.toLowerCase()}|${p.state.toLowerCase()}`)
      );
      
      // Filter out duplicates
      const newProps = props.filter(p => {
        const key = `${p.name.toLowerCase()}|${p.city.toLowerCase()}|${p.state.toLowerCase()}`;
        return !existingKeys.has(key);
      });
      
      const skippedCount = props.length - newProps.length;
      if (skippedCount > 0) {
        console.log(`[Upload] Skipped ${skippedCount} duplicate properties`);
      }
      
      if (newProps.length === 0) {
        // All properties already exist
        return { created: [], skipped: skippedCount };
      }
      
      // Insert new properties only
      const { data: createdProperties, error } = await supabase
        .from('properties')
        .insert(newProps.map(p => ({ 
          name: p.name, 
          city: p.city, 
          state: p.state,
          user_id: user.id,
          google_place_id: p.sourceIds?.google || null,
          tripadvisor_url: p.sourceIds?.tripadvisor || null,
          booking_url: p.sourceIds?.booking || null,
          expedia_url: p.sourceIds?.expedia || null,
        })))
        .select();
      if (error) throw error;
      
      // Create hotel_aliases for any properties with source IDs
      const aliasInserts: Array<{
        property_id: string;
        source: ReviewSource;
        source_id_or_url: string;
        platform_id?: string;
        platform_url?: string;
        resolution_status: string;
        confidence_score: number;
        last_resolved_at: string;
        last_verified_at: string;
      }> = [];
      
      for (let i = 0; i < newProps.length; i++) {
        const prop = newProps[i];
        const created = createdProperties[i];
        
        if (prop.sourceIds) {
          const sources: ReviewSource[] = ['google', 'tripadvisor', 'booking', 'expedia'];
          for (const source of sources) {
            const sourceId = prop.sourceIds[source];
            if (sourceId) {
              aliasInserts.push({
                property_id: created.id,
                source,
                source_id_or_url: sourceId,
                platform_id: source === 'google' ? sourceId : undefined,
                platform_url: source !== 'google' ? sourceId : undefined,
                resolution_status: 'resolved',
                confidence_score: 1.0,
                last_resolved_at: new Date().toISOString(),
                last_verified_at: new Date().toISOString(),
              });
            }
          }
        }
      }
      
      // Insert aliases if any
      if (aliasInserts.length > 0) {
        const { error: aliasError } = await supabase
          .from('hotel_aliases')
          .insert(aliasInserts);
        if (aliasError) {
          console.error('Error creating aliases from CSV:', aliasError);
        }
      }
      
      return { created: createdProperties as Property[], skipped: skippedCount };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['hotel-aliases'] });
    },
  });

  const deleteProperty = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['hotel-aliases'] });
    },
  });

  return {
    properties,
    isLoading,
    error,
    createProperty,
    createManyProperties,
    deleteProperty,
  };
}
