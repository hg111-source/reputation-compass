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
 
 export function normalizeScore(rawScore: number, scale: number): number {
   return (rawScore / scale) * 10;
 }
 
 export function calculateWeightedScore(
   scores: Array<{ normalized: number; count: number }>
 ): number | null {
   const validScores = scores.filter(s => s.count > 0);
   if (validScores.length === 0) return null;
   
   const totalWeightedScore = validScores.reduce(
     (sum, s) => sum + s.normalized * s.count,
     0
   );
   const totalCount = validScores.reduce((sum, s) => sum + s.count, 0);
   
   return totalWeightedScore / totalCount;
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
 
export function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 8) return 'text-green-600';
  if (score >= 6) return 'text-amber-500';
  return 'text-red-500';
}
 
 export function formatScore(score: number | null | undefined): string {
   if (score === null || score === undefined) return '—';
   return score.toFixed(1);
 }