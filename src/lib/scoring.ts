import { ReviewSource, SourceSnapshot } from './types';

export const REVIEW_SOURCES: ReviewSource[] = ['google', 'tripadvisor', 'expedia', 'booking'];

export const SOURCE_LABELS: Record<ReviewSource, string> = {
  google: 'Google',
  tripadvisor: 'TripAdvisor',
  expedia: 'Expedia',
  booking: 'Booking.com',
};

export const SOURCE_SCALES: Record<ReviewSource, number> = {
  google: 5,
  tripadvisor: 5,
  expedia: 10,
  booking: 10,
};

/**
 * Normalizes a raw score to a 0-10 scale.
 * 
 * Each platform uses a different rating scale:
 * - Google: 1-5 stars
 * - TripAdvisor: 1-5 scale (displayed as "bubbles")
 * - Booking.com: 1-10 scale
 * - Expedia: 1-10 scale
 * 
 * Formula: normalized = (rawScore / originalScale) × 10
 * 
 * Example: Google 4.5/5 → (4.5/5) × 10 = 9.0
 */
export function normalizeScore(rawScore: number, scale: number): number {
  return (rawScore / scale) * 10;
}

/**
 * ============================================================================
 * WEIGHTED AVERAGE SCORE CALCULATION
 * ============================================================================
 * 
 * FORMULA:
 *   weightedAverage = Σ(normalizedScore × reviewCount) / Σ(reviewCount)
 * 
 * WHERE:
 *   - normalizedScore = platform score normalized to 0-10 scale
 *   - reviewCount = number of reviews on that platform
 * 
 * EXAMPLE:
 *   Google:      9.2 × 1,071 = 9,853.2
 *   TripAdvisor: 9.4 × 1,204 = 11,317.6
 *   Booking:     9.0 × 252   = 2,268.0
 *   Expedia:     9.6 × 699   = 6,710.4
 *   -----------------------------------
 *   Total Points:             30,149.2
 *   Total Reviews:            3,226
 *   Weighted Average:         30,149.2 / 3,226 = 9.34
 * 
 * ============================================================================
 * ASSUMPTIONS
 * ============================================================================
 * 
 * 1. REVIEW COUNT AS WEIGHT PROXY
 *    - Higher review counts indicate more statistical significance
 *    - A platform with 1,000 reviews should have more influence than one with 50
 *    - This prevents a single review from disproportionately skewing the average
 * 
 * 2. NORMALIZED SCORES ARE COMPARABLE
 *    - After normalization to 0-10, scores from different platforms are assumed
 *      to be directly comparable (e.g., 9.0 on Google ≈ 9.0 on Booking.com)
 *    - Reality: Different platforms may have different rating cultures/biases
 * 
 * 3. PLATFORMS WITH NO DATA ARE EXCLUDED
 *    - If a property has no reviews on a platform, that platform is skipped
 *    - Only platforms with count > 0 contribute to the weighted average
 *    - This avoids dividing by zero and artificially lowering scores
 * 
 * 4. ZERO SCORES WITH REVIEWS ARE EXCLUDED
 *    - If score = 0 but count > 0, the platform is excluded
 *    - Assumption: score = 0 indicates missing/invalid data, not a true rating
 * 
 * 5. ALL PLATFORMS WEIGHTED EQUALLY (per review)
 *    - No platform is given preferential treatment beyond its review count
 *    - A Google review has the same weight as a Booking.com review
 * 
 * 6. RECENCY NOT FACTORED
 *    - The calculation uses the most recent snapshot for each platform
 *    - Historical score trends do not affect the current weighted average
 * 
 * ============================================================================
 * COLOR CODING THRESHOLDS
 * ============================================================================
 * 
 * - GREEN  (≥8.0): Excellent performance
 * - YELLOW (6.0-7.9): Acceptable, room for improvement
 * - RED    (<6.0): Needs attention
 * 
 * ============================================================================
 */
export function calculateWeightedScore(
  scores: Array<{ normalized: number; count: number }>
): number | null {
  // Filter to only platforms with valid data (count > 0 and score > 0)
  const validScores = scores.filter(s => s.count > 0 && s.normalized > 0);
  
  // Return null if no valid data (displays as "N/A")
  if (validScores.length === 0) return null;
  
  // Sum of (score × reviewCount) for all platforms
  const totalWeightedScore = validScores.reduce(
    (sum, s) => sum + s.normalized * s.count,
    0
  );
  
  // Sum of all review counts
  const totalCount = validScores.reduce((sum, s) => sum + s.count, 0);
  
  // Weighted average = total points / total reviews
  return totalWeightedScore / totalCount;
}

/**
 * Calculates the weighted average score from platform score records.
 * 
 * @param platformScores - Record of platform scores keyed by ReviewSource
 * @returns { avgScore: number | null, totalReviews: number }
 */
export function calculatePropertyMetrics(
  platformScores: Partial<Record<ReviewSource, { score: number; count: number }>> | undefined
): { avgScore: number | null; totalReviews: number } {
  if (!platformScores) {
    return { avgScore: null, totalReviews: 0 };
  }

  let totalPoints = 0;
  let totalReviews = 0;

  for (const platform of REVIEW_SOURCES) {
    const data = platformScores[platform];
    if (data && data.score > 0 && data.count > 0) {
      totalPoints += data.score * data.count;
      totalReviews += data.count;
    }
  }

  const avgScore = totalReviews > 0 ? totalPoints / totalReviews : null;
  return { avgScore, totalReviews };
}

export function generateSampleScores(): Array<{
  source: ReviewSource;
  score_raw: number;
  score_scale: number;
  review_count: number;
  normalized_score_0_10: number;
}> {
  return REVIEW_SOURCES.map(source => {
    const scale = SOURCE_SCALES[source];
    const rawScore = parseFloat((Math.random() * (scale * 0.3) + scale * 0.7).toFixed(1));
    const reviewCount = Math.floor(Math.random() * 500) + 10;
    const normalized = normalizeScore(rawScore, scale);
    
    return {
      source,
      score_raw: rawScore,
      score_scale: scale,
      review_count: reviewCount,
      normalized_score_0_10: parseFloat(normalized.toFixed(2)),
    };
  });
}

/**
 * Returns the appropriate color class based on score thresholds.
 * 
 * Score Tiers (0-10 scale):
 * - Wonderful (≥9.0): Emerald - exceptional performance
 * - Very Good (≥8.0): Blue - strong performance
 * - Good (≥7.0): Yellow - solid performance
 * - Pleasant (≥6.0): Orange - acceptable, room for improvement
 * - Needs Work (<6.0): Red - requires attention
 */
export function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 9) return 'text-emerald-500';  // Wonderful
  if (score >= 8) return 'text-blue-500';     // Very Good
  if (score >= 7) return 'text-yellow-500';   // Good
  if (score >= 6) return 'text-orange-500';   // Pleasant
  return 'text-red-500';                      // Needs Work
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '—';
  return score.toFixed(1);
}