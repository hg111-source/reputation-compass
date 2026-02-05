import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property } from '@/lib/types';

export type ReviewSource = 'google' | 'tripadvisor' | 'booking' | 'expedia';
export type ResolutionStatus = 'pending' | 'resolved' | 'needs_review' | 'not_listed' | 'scrape_failed' | 'timeout';

export interface Candidate {
  name: string;
  url?: string;
  platformId?: string;
  confidence: number;
  reason: string;
}

export interface HotelAlias {
  id: string;
  property_id: string;
  source: ReviewSource;
  platform_id: string | null;
  platform_url: string | null;
  platform_name: string | null;
  resolution_status: ResolutionStatus;
  confidence_score: number | null;
  candidate_options: Candidate[];
  last_resolved_at: string | null;
  last_error: string | null;
}

export interface SourceResolution {
  source: ReviewSource;
  status: ResolutionStatus;
  platformId?: string;
  platformUrl?: string;
  platformName?: string;
  confidence?: number;
  candidates?: Candidate[];
  error?: string;
  debug: {
    attempts: number;
    queries: string[];
    duration_ms: number;
  };
}

export interface ResolveIdentityResult {
  success: boolean;
  resolutions: SourceResolution[];
  debug: {
    total_duration_ms: number;
    property_id: string;
    hotel_name: string;
  };
  error?: string;
}

interface ResolveIdentityParams {
  property: Property;
  sources: ReviewSource[];
}

export function useHotelAliases(propertyId?: string) {
  return useQuery({
    queryKey: ['hotel-aliases', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      
      const { data, error } = await supabase
        .from('hotel_aliases')
        .select('*')
        .eq('property_id', propertyId);

      if (error) throw error;
      
      // Transform the data to match our interface (handle Json type for candidate_options)
      return (data || []).map(alias => ({
        ...alias,
        candidate_options: (alias.candidate_options || []) as unknown as Candidate[],
      })) as HotelAlias[];
    },
    enabled: !!propertyId,
  });
}

export function useResolveIdentity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ property, sources }: ResolveIdentityParams): Promise<ResolveIdentityResult> => {
      const { data, error } = await supabase.functions.invoke('resolve-identity', {
        body: {
          propertyId: property.id,
          hotelName: property.name,
          city: property.city,
          state: property.state,
          sources,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to resolve identity');
      }

      if (!data.success) {
        throw new Error(data.error || 'Resolution failed');
      }

      return data as ResolveIdentityResult;
    },
    onSuccess: (_, { property }) => {
      queryClient.invalidateQueries({ queryKey: ['hotel-aliases', property.id] });
      queryClient.invalidateQueries({ queryKey: ['hotel-aliases'] });
    },
  });
}

// Hook to update an alias manually (for resolving needs_review)
export function useUpdateAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      propertyId, 
      source, 
      platformId,
      platformUrl,
      platformName,
    }: { 
      propertyId: string;
      source: ReviewSource;
      platformId?: string;
      platformUrl?: string;
      platformName?: string;
    }) => {
      const { data, error } = await supabase
        .from('hotel_aliases')
        .update({
          platform_id: platformId || null,
          platform_url: platformUrl || null,
          platform_name: platformName || null,
          resolution_status: 'resolved',
          confidence_score: 1.0, // Manual selection = full confidence
          last_resolved_at: new Date().toISOString(),
          candidate_options: [],
        })
        .eq('property_id', propertyId)
        .eq('source', source)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { propertyId }) => {
      queryClient.invalidateQueries({ queryKey: ['hotel-aliases', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['hotel-aliases'] });
    },
  });
}

// Helper to get display name for resolution status
export function getResolutionStatusDisplay(status: ResolutionStatus): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  switch (status) {
    case 'resolved':
      return { label: 'Resolved', variant: 'default' };
    case 'needs_review':
      return { label: 'Needs Review', variant: 'secondary' };
    case 'not_listed':
      return { label: 'Not Listed', variant: 'outline' };
    case 'scrape_failed':
      return { label: 'Failed', variant: 'destructive' };
    case 'timeout':
      return { label: 'Timeout', variant: 'destructive' };
    case 'pending':
    default:
      return { label: 'Pending', variant: 'outline' };
  }
}
