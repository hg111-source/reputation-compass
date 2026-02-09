import { useMemo } from 'react';
import { useGroupProperties } from './useGroups';
import { useLatestPropertyScores } from './useSnapshots';
import { calculatePropertyMetrics } from '@/lib/scoring';
import { Property, ReviewSource } from '@/lib/types';

interface GroupMetrics {
  avgScore: number | null;
  totalProperties: number;
  totalReviews: number;
  isLoading: boolean;
  properties: Property[];
  scores: Record<string, Record<ReviewSource, { score: number; count: number; updated: string }> | undefined>;
}

/**
 * Calculates group-level weighted average score.
 * 
 * Formula:
 *   Group Avg = Σ(hotel_weighted_avg × hotel_total_reviews) / Σ(hotel_total_reviews)
 * 
 * This ensures hotels with more reviews have proportionally more influence
 * on the group average, providing a statistically meaningful aggregate score.
 */
export function useGroupMetrics(groupId: string | null): GroupMetrics {
  const { properties, isLoading: propertiesLoading } = useGroupProperties(groupId);
  const propertyIds = properties.map(p => p.id);
  const { data: scores = {}, isLoading: scoresLoading } = useLatestPropertyScores(propertyIds);

  const metrics = useMemo(() => {
    if (!groupId || properties.length === 0) {
      return { avgScore: null, totalProperties: 0, totalReviews: 0 };
    }

    let weightedSum = 0;
    let totalReviews = 0;

    for (const property of properties) {
      const propertyScores = scores[property.id];
      const { avgScore, totalReviews: propReviews } = calculatePropertyMetrics(propertyScores);

      if (avgScore !== null && propReviews > 0) {
        weightedSum += avgScore * propReviews;
        totalReviews += propReviews;
      }

      // Fold in Kasa internal scores (same as PlatformBreakdown)
      if (property.kasa_aggregated_score && property.kasa_review_count && property.kasa_review_count > 0) {
        const normalizedScore = (property.kasa_aggregated_score / 5) * 10;
        weightedSum += normalizedScore * property.kasa_review_count;
        totalReviews += property.kasa_review_count;
      }
    }

    // Group weighted average = sum of weighted hotel scores / total reviews
    const avgScore = totalReviews > 0 ? weightedSum / totalReviews : null;

    return {
      avgScore,
      totalProperties: properties.length,
      totalReviews,
    };
  }, [groupId, properties, scores]);

  return {
    ...metrics,
    properties,
    scores,
    isLoading: propertiesLoading || scoresLoading,
  };
}
