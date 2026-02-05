import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ThemeResult {
  theme: string;
  count: number;
  quote: string;
}

interface ReviewAnalysis {
  id: string;
  property_id: string;
  positive_themes: ThemeResult[];
  negative_themes: ThemeResult[];
  summary: string | null;
  review_count: number;
  analyzed_at: string;
}

export function useReviewAnalysis(propertyId: string | null) {
  return useQuery({
    queryKey: ['review-analysis', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      
      const { data, error } = await supabase
        .from('review_analysis')
        .select('*')
        .eq('property_id', propertyId)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      
      // Transform the data to match our interface
      return {
        id: data.id,
        property_id: data.property_id,
        positive_themes: (data.positive_themes as unknown as ThemeResult[]) || [],
        negative_themes: (data.negative_themes as unknown as ThemeResult[]) || [],
        summary: data.summary,
        review_count: data.review_count,
        analyzed_at: data.analyzed_at,
      } as ReviewAnalysis;
    },
    enabled: !!propertyId,
  });
}

export function useReviewCount(propertyId: string | null) {
  return useQuery({
    queryKey: ['review-texts-count', propertyId],
    queryFn: async () => {
      if (!propertyId) return 0;
      
      const { count, error } = await supabase
        .from('review_texts')
        .select('*', { count: 'exact', head: true })
        .eq('property_id', propertyId);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!propertyId,
  });
}

export function useFetchReviews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      propertyId, 
      hotelName, 
      city, 
      platform = 'tripadvisor',
      maxReviews = 50 
    }: { 
      propertyId: string; 
      hotelName: string; 
      city: string;
      platform?: string;
      maxReviews?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('fetch-reviews', {
        body: { propertyId, hotelName, city, platform, maxReviews },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['review-texts-count', variables.propertyId] });
    },
  });
}

export function useAnalyzeReviews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, groupId }: { propertyId?: string; groupId?: string }) => {
      const { data, error } = await supabase.functions.invoke('analyze-reviews', {
        body: { propertyId, groupId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (_, variables) => {
      if (variables.propertyId) {
        queryClient.invalidateQueries({ queryKey: ['review-analysis', variables.propertyId] });
      }
      if (variables.groupId) {
        queryClient.invalidateQueries({ queryKey: ['group-review-analysis', variables.groupId] });
      }
    },
  });
}

export function useGroupReviewAnalysis(groupId: string | null) {
  const analyzeReviews = useAnalyzeReviews();
  
  const analyze = async () => {
    if (!groupId) return null;
    return analyzeReviews.mutateAsync({ groupId });
  };

  return {
    analyze,
    isAnalyzing: analyzeReviews.isPending,
  };
}
