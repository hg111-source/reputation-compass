import { useMemo } from 'react';
import { useGroupProperties } from './useGroups';
import { useLatestPropertyScores } from './useSnapshots';
import { calculatePropertyMetrics } from '@/lib/scoring';

interface GroupMetrics {
  avgScore: number | null;
  totalProperties: number;
  totalReviews: number;
  isLoading: boolean;
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
        // Each hotel's weighted avg × its total reviews
        weightedSum += avgScore * propReviews;
        totalReviews += propReviews;
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
    isLoading: propertiesLoading || scoresLoading,
  };
}
