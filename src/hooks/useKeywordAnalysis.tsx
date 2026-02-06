import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Predefined keyword lists
export const POSITIVE_KEYWORDS = [
  { keyword: 'clean', label: 'Cleanliness' },
  { keyword: 'friendly', label: 'Friendly Staff' },
  { keyword: 'great location', label: 'Great Location' },
  { keyword: 'comfortable', label: 'Comfortable' },
  { keyword: 'helpful', label: 'Helpful Staff' },
  { keyword: 'beautiful', label: 'Beautiful' },
  { keyword: 'amazing', label: 'Amazing' },
  { keyword: 'excellent', label: 'Excellent' },
  { keyword: 'quiet', label: 'Quiet' },
  { keyword: 'spacious', label: 'Spacious' },
  { keyword: 'delicious', label: 'Delicious Food' },
  { keyword: 'convenient', label: 'Convenient' },
  { keyword: 'modern', label: 'Modern' },
  { keyword: 'cozy', label: 'Cozy' },
  { keyword: 'attentive', label: 'Attentive Service' },
];

export const NEGATIVE_KEYWORDS = [
  { keyword: 'dirty', label: 'Cleanliness Issues' },
  { keyword: 'rude', label: 'Rude Staff' },
  { keyword: 'noisy', label: 'Noise Issues' },
  { keyword: 'expensive', label: 'Expensive' },
  { keyword: 'slow', label: 'Slow Service' },
  { keyword: 'small', label: 'Small Rooms' },
  { keyword: 'outdated', label: 'Outdated' },
  { keyword: 'broken', label: 'Broken Items' },
  { keyword: 'uncomfortable', label: 'Uncomfortable' },
  { keyword: 'disappointing', label: 'Disappointing' },
  { keyword: 'overpriced', label: 'Overpriced' },
  { keyword: 'cold', label: 'Temperature Issues' },
  { keyword: 'hot', label: 'Temperature Issues' },
  { keyword: 'smelly', label: 'Odor Issues' },
  { keyword: 'crowded', label: 'Crowded' },
];

export interface ThemeCount {
  theme: string;
  keyword: string;
  count: number;
  exampleReview?: string;
}

export interface KeywordAnalysisResult {
  positiveThemes: ThemeCount[];
  negativeThemes: ThemeCount[];
  totalReviews: number;
  analyzedAt: Date;
}

// Count keyword occurrences in reviews
function analyzeReviewsWithKeywords(reviews: { review_text: string }[]): KeywordAnalysisResult {
  const positiveCounts: Map<string, { count: number; example?: string }> = new Map();
  const negativeCounts: Map<string, { count: number; example?: string }> = new Map();

  // Initialize counts
  POSITIVE_KEYWORDS.forEach(({ keyword, label }) => {
    positiveCounts.set(keyword, { count: 0 });
  });
  NEGATIVE_KEYWORDS.forEach(({ keyword, label }) => {
    negativeCounts.set(keyword, { count: 0 });
  });

  // Count keywords in each review
  reviews.forEach(({ review_text }) => {
    const lowerText = review_text.toLowerCase();

    POSITIVE_KEYWORDS.forEach(({ keyword }) => {
      if (lowerText.includes(keyword)) {
        const current = positiveCounts.get(keyword)!;
        positiveCounts.set(keyword, {
          count: current.count + 1,
          example: current.example || review_text.slice(0, 200),
        });
      }
    });

    NEGATIVE_KEYWORDS.forEach(({ keyword }) => {
      if (lowerText.includes(keyword)) {
        const current = negativeCounts.get(keyword)!;
        negativeCounts.set(keyword, {
          count: current.count + 1,
          example: current.example || review_text.slice(0, 200),
        });
      }
    });
  });

  // Convert to sorted arrays (top 5)
  const positiveThemes: ThemeCount[] = POSITIVE_KEYWORDS
    .map(({ keyword, label }) => ({
      theme: label,
      keyword,
      count: positiveCounts.get(keyword)!.count,
      exampleReview: positiveCounts.get(keyword)!.example,
    }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const negativeThemes: ThemeCount[] = NEGATIVE_KEYWORDS
    .map(({ keyword, label }) => ({
      theme: label,
      keyword,
      count: negativeCounts.get(keyword)!.count,
      exampleReview: negativeCounts.get(keyword)!.example,
    }))
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    positiveThemes,
    negativeThemes,
    totalReviews: reviews.length,
    analyzedAt: new Date(),
  };
}

// Hook for property-level keyword analysis
export function usePropertyKeywordAnalysis(propertyId: string | null) {
  return useQuery({
    queryKey: ['keyword-analysis', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;

      const { data: reviews, error } = await supabase
        .from('review_texts')
        .select('review_text')
        .eq('property_id', propertyId);

      if (error) throw error;
      if (!reviews || reviews.length === 0) return null;

      return analyzeReviewsWithKeywords(reviews);
    },
    enabled: !!propertyId,
  });
}

// Hook for group-level keyword analysis
export function useGroupKeywordAnalysis(groupId: string | null) {
  return useQuery({
    queryKey: ['group-keyword-analysis', groupId],
    queryFn: async () => {
      if (!groupId) return null;

      // Get all property IDs in the group
      const { data: groupProperties, error: gpError } = await supabase
        .from('group_properties')
        .select('property_id')
        .eq('group_id', groupId);

      if (gpError) throw gpError;
      if (!groupProperties || groupProperties.length === 0) return null;

      const propertyIds = groupProperties.map(gp => gp.property_id);

      // Fetch all reviews for these properties
      const { data: reviews, error: reviewsError } = await supabase
        .from('review_texts')
        .select('review_text')
        .in('property_id', propertyIds);

      if (reviewsError) throw reviewsError;
      if (!reviews || reviews.length === 0) return null;

      return analyzeReviewsWithKeywords(reviews);
    },
    enabled: !!groupId,
  });
}

// Hook to fetch reviews count for a property
export function usePropertyReviewCount(propertyId: string | null) {
  return useQuery({
    queryKey: ['review-count', propertyId],
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

// Hook to fetch reviews count for a group
export function useGroupReviewCount(groupId: string | null) {
  return useQuery({
    queryKey: ['group-review-count', groupId],
    queryFn: async () => {
      if (!groupId) return 0;

      // Get all property IDs in the group
      const { data: groupProperties, error: gpError } = await supabase
        .from('group_properties')
        .select('property_id')
        .eq('group_id', groupId);

      if (gpError) throw gpError;
      if (!groupProperties || groupProperties.length === 0) return 0;

      const propertyIds = groupProperties.map(gp => gp.property_id);

      const { count, error } = await supabase
        .from('review_texts')
        .select('*', { count: 'exact', head: true })
        .in('property_id', propertyIds);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!groupId,
  });
}
