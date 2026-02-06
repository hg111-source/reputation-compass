import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Target, AlertTriangle, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Property {
  id: string;
  name: string;
  city: string;
  state: string;
  kasa_url?: string | null;
  kasa_aggregated_score?: number | null;
  kasa_review_count?: number | null;
}

interface KasaSnapshot {
  score_raw: number | null;
  review_count: number | null;
}

interface SwotAnalysisProps {
  properties: Property[];
  snapshots: Record<string, KasaSnapshot>;
}

// Score tier thresholds
const TIERS = {
  exceptional: { min: 9.5, label: 'Exceptional' },
  wonderful: { min: 9.0, label: 'Wonderful' },
  veryGood: { min: 8.0, label: 'Very Good' },
  good: { min: 7.0, label: 'Good' },
  pleasant: { min: 6.0, label: 'Pleasant' },
};

export function SwotAnalysis({ properties, snapshots }: SwotAnalysisProps) {
  // Calculate all metrics for SWOT
  const swotData = useMemo(() => {
    const propertyScores = properties.map(p => {
      const snapshot = snapshots[p.id];
      const score5 = snapshot?.score_raw ?? p.kasa_aggregated_score;
      const score10 = score5 ? Number(score5) * 2 : null;
      const reviewCount = snapshot?.review_count ?? p.kasa_review_count ?? 0;
      return { ...p, score10, reviewCount };
    }).filter(p => p.score10 !== null);

    // Count by tier
    const exceptional = propertyScores.filter(p => p.score10! >= 9.5);
    const wonderful = propertyScores.filter(p => p.score10! >= 9.0 && p.score10! < 9.5);
    const veryGood = propertyScores.filter(p => p.score10! >= 8.0 && p.score10! < 9.0);
    const good = propertyScores.filter(p => p.score10! >= 7.0 && p.score10! < 8.0);
    const belowGood = propertyScores.filter(p => p.score10! < 7.0);

    // Very Good or higher
    const veryGoodPlus = propertyScores.filter(p => p.score10! >= 8.0);
    const veryGoodPlusPercent = Math.round((veryGoodPlus.length / propertyScores.length) * 100);

    // Total reviews
    const totalReviews = propertyScores.reduce((sum, p) => sum + (p.reviewCount || 0), 0);

    // Properties close to next tier (within 0.5 points)
    const closeToVeryGood = propertyScores.filter(p => p.score10! >= 7.5 && p.score10! < 8.0);
    const closeToWonderful = propertyScores.filter(p => p.score10! >= 8.5 && p.score10! < 9.0);
    const closeToExceptional = propertyScores.filter(p => p.score10! >= 9.0 && p.score10! < 9.5);

    // Lowest performers
    const lowestPerformers = [...propertyScores]
      .sort((a, b) => (a.score10 ?? 0) - (b.score10 ?? 0))
      .slice(0, 3);

    // Properties with low review count (< 50)
    const lowReviewCount = propertyScores.filter(p => p.reviewCount < 50);

    // Average score
    const avgScore = propertyScores.length > 0
      ? propertyScores.reduce((sum, p) => sum + (p.score10 ?? 0), 0) / propertyScores.length
      : 0;

    return {
      total: propertyScores.length,
      exceptional,
      wonderful,
      veryGood,
      good,
      belowGood,
      veryGoodPlus,
      veryGoodPlusPercent,
      totalReviews,
      closeToVeryGood,
      closeToWonderful,
      closeToExceptional,
      lowestPerformers,
      lowReviewCount,
      avgScore,
    };
  }, [properties, snapshots]);

  // Generate dynamic strengths
  const strengths = useMemo(() => {
    const items: string[] = [];
    
    if (swotData.veryGoodPlusPercent >= 90) {
      items.push(`${swotData.veryGoodPlus.length} of ${swotData.total} properties rated "Very Good" or higher (${swotData.veryGoodPlusPercent}%!)`);
    } else if (swotData.veryGoodPlusPercent >= 75) {
      items.push(`${swotData.veryGoodPlus.length} of ${swotData.total} properties rated "Very Good" or higher (${swotData.veryGoodPlusPercent}%)`);
    }

    if (swotData.exceptional.length > 0) {
      items.push(`${swotData.exceptional.length} properties achieving "Exceptional" status (9.5+)`);
    }

    if (swotData.avgScore >= 9.0) {
      items.push(`Portfolio average of ${swotData.avgScore.toFixed(2)} ranks in elite tier`);
    } else if (swotData.avgScore >= 8.5) {
      items.push(`Strong portfolio average of ${swotData.avgScore.toFixed(2)}`);
    }

    if (swotData.totalReviews >= 50000) {
      items.push(`${swotData.totalReviews.toLocaleString()} reviews = strong reputation foundation`);
    } else if (swotData.totalReviews >= 10000) {
      items.push(`${swotData.totalReviews.toLocaleString()} reviews building trust`);
    }

    if (swotData.belowGood.length === 0) {
      items.push(`Zero properties below "Good" threshold — consistent quality across portfolio`);
    }

    return items.slice(0, 4);
  }, [swotData]);

  // Generate dynamic opportunities
  const opportunities = useMemo(() => {
    const items: string[] = [];

    if (swotData.closeToVeryGood.length > 0) {
      items.push(`${swotData.closeToVeryGood.length} ${swotData.closeToVeryGood.length === 1 ? 'property' : 'properties'} within reach of "Very Good" — quick wins available`);
    }

    if (swotData.closeToWonderful.length > 0) {
      items.push(`${swotData.closeToWonderful.length} ${swotData.closeToWonderful.length === 1 ? 'property' : 'properties'} close to "Wonderful" tier (8.5-9.0)`);
    }

    if (swotData.closeToExceptional.length > 0) {
      items.push(`${swotData.closeToExceptional.length} ${swotData.closeToExceptional.length === 1 ? 'property' : 'properties'} approaching "Exceptional" — within 0.5 points`);
    }

    if (swotData.belowGood.length > 0 && swotData.belowGood.length <= 3) {
      const lowest = swotData.belowGood[0];
      items.push(`${lowest.name} at ${lowest.score10?.toFixed(1)} has clear improvement path`);
    }

    if (swotData.lowReviewCount.length > 0 && swotData.lowReviewCount.length <= 5) {
      items.push(`${swotData.lowReviewCount.length} newer properties building review momentum`);
    }

    if (items.length === 0) {
      items.push('All properties performing strongly — focus on maintaining excellence');
    }

    return items.slice(0, 4);
  }, [swotData]);

  // Generate dynamic areas to watch
  const areasToWatch = useMemo(() => {
    const items: { text: string; context?: string }[] = [];

    // Add lowest performers with context
    swotData.lowestPerformers.forEach((p, i) => {
      if (p.score10 && p.score10 < 8.0 && i < 2) {
        let context = '';
        if (p.reviewCount < 50) {
          context = 'newer property, still ramping up';
        } else if (p.reviewCount < 100) {
          context = 'building review base';
        }
        items.push({ 
          text: `${p.name} (${p.score10.toFixed(1)})`,
          context 
        });
      }
    });

    // Low review count properties
    if (swotData.lowReviewCount.length > 0) {
      items.push({ 
        text: `${swotData.lowReviewCount.length} ${swotData.lowReviewCount.length === 1 ? 'property' : 'properties'} with <50 reviews`,
        context: 'need volume for reliable scores'
      });
    }

    // Properties just above threshold
    if (swotData.good.length > 0) {
      items.push({
        text: `${swotData.good.length} ${swotData.good.length === 1 ? 'property' : 'properties'} in "Good" tier (7.0-8.0)`,
        context: 'platform-specific focus may help'
      });
    }

    if (items.length === 0) {
      items.push({ text: 'No significant concerns identified', context: 'maintain current standards' });
    }

    return items.slice(0, 4);
  }, [swotData]);

  // Generate competitive advantages
  const competitiveAdvantages = useMemo(() => {
    const items: string[] = [];

    items.push(`Consistent quality at scale (${swotData.total} properties) is rare in industry`);

    if (swotData.veryGoodPlusPercent >= 90) {
      items.push('Guest experience scores outpace most competitors');
    }

    if (swotData.totalReviews >= 10000) {
      items.push('Strong review volume builds trust & SEO');
    }

    items.push('Aggregated reputation management = competitive moat');

    return items.slice(0, 4);
  }, [swotData]);

  if (properties.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📊 Kasa Portfolio SWOT Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Strengths - Green */}
          <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <h3 className="font-semibold text-emerald-700 dark:text-emerald-400">Strengths</h3>
            </div>
            <ul className="space-y-2">
              {strengths.map((item, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5">•</span>
                  <span className="text-emerald-900 dark:text-emerald-100">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Opportunities - Blue */}
          <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-700 dark:text-blue-400">Opportunities</h3>
            </div>
            <ul className="space-y-2">
              {opportunities.map((item, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span className="text-blue-900 dark:text-blue-100">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Areas to Watch - Yellow */}
          <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-amber-700 dark:text-amber-400">Areas to Watch</h3>
            </div>
            <ul className="space-y-2">
              {areasToWatch.map((item, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-amber-600 mt-0.5">•</span>
                  <span className="text-amber-900 dark:text-amber-100">
                    {item.text}
                    {item.context && (
                      <span className="text-amber-600 dark:text-amber-400"> — {item.context}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Competitive Advantage - Teal */}
          <div className="rounded-lg border bg-teal-50 dark:bg-teal-950/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-5 w-5 text-teal-600" />
              <h3 className="font-semibold text-teal-700 dark:text-teal-400">Competitive Advantage</h3>
            </div>
            <ul className="space-y-2">
              {competitiveAdvantages.map((item, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-teal-600 mt-0.5">•</span>
                  <span className="text-teal-900 dark:text-teal-100">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
