import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Trophy, AlertTriangle, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScoreColor } from '@/lib/scoring';
import { GeographicAnalysis } from './GeographicAnalysis';
import { KasaOTAPlatformCard } from './KasaOTAPlatformCard';
import { SwotAnalysis } from './SwotAnalysis';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

// Industry benchmark data (configurable)
const INDUSTRY_BENCHMARKS = {
  percentiles: [50, 75, 90, 95, 99],
  platforms: {
    google: { name: 'Google', values: [8.20, 8.40, 8.80, 9.00, 9.34] },
    booking: { name: 'Booking', values: [8.00, 8.40, 8.60, 8.80, 9.10] },
    expedia: { name: 'Expedia', values: [8.40, 8.80, 9.00, 9.20, 9.55] },
    tripadvisor: { name: 'TripAdvisor', values: [8.34, 8.76, 9.00, 9.24, 9.60] },
    airbnb: { name: 'Airbnb', values: [9.00, 9.20, 9.40, 9.60, 9.80] },
  },
};

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

interface KasaBenchmarkTabProps {
  properties: Property[];
  snapshots: Record<string, KasaSnapshot>;
}

// Calculate percentile rank for a score
function calculatePercentile(score: number, benchmarkValues: number[]): number {
  const [p50, p75, p90, p95, p99] = benchmarkValues;
  
  if (score >= p99) return 99;
  if (score >= p95) return 95 + (score - p95) / (p99 - p95) * 4;
  if (score >= p90) return 90 + (score - p90) / (p95 - p90) * 5;
  if (score >= p75) return 75 + (score - p75) / (p90 - p75) * 15;
  if (score >= p50) return 50 + (score - p50) / (p75 - p50) * 25;
  return Math.max(0, 50 * (score / p50));
}

// Get tier info based on percentile
function getPercentileTier(percentile: number): { label: string; color: string; bgColor: string } {
  if (percentile >= 90) return { label: 'Top 10%', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' };
  if (percentile >= 75) return { label: 'Top 25%', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' };
  if (percentile >= 50) return { label: 'Top 50%', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' };
  return { label: 'Below Median', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' };
}

// Get color for histogram bars
function getHistogramColor(rangeStart: number): string {
  if (rangeStart >= 9) return 'hsl(var(--emerald-500, 142 76% 36%))';
  if (rangeStart >= 8) return 'hsl(var(--blue-500, 217 91% 60%))';
  if (rangeStart >= 7) return 'hsl(var(--yellow-500, 48 96% 53%))';
  if (rangeStart >= 6) return 'hsl(var(--orange-500, 25 95% 53%))';
  return 'hsl(var(--red-500, 0 84% 60%))';
}

export function KasaBenchmarkTab({ properties, snapshots }: KasaBenchmarkTabProps) {
  // Calculate portfolio metrics
  const metrics = useMemo(() => {
    const scores: number[] = [];
    
    properties.forEach(p => {
      const snapshot = snapshots[p.id];
      const score5 = snapshot?.score_raw ?? p.kasa_aggregated_score;
      if (score5 !== null && score5 !== undefined) {
        scores.push(Number(score5) * 2); // Convert to /10 scale
      }
    });
    
    if (scores.length === 0) {
      return { avg: null, median: null, stdDev: null, scores };
    }
    
    // Calculate average
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    // Calculate median
    const sorted = [...scores].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    // Calculate standard deviation
    const squaredDiffs = scores.map(s => Math.pow(s - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / scores.length;
    const stdDev = Math.sqrt(avgSquaredDiff);
    
    return { avg, median, stdDev, scores };
  }, [properties, snapshots]);

  // Platform averages removed - Kasa properties don't have OTA platform scores

  // Calculate percentile for Kasa portfolio (using Airbnb as reference since Kasa aggregates similar platforms)
  const kasaPercentile = useMemo(() => {
    if (metrics.avg === null) return null;
    return calculatePercentile(metrics.avg, INDUSTRY_BENCHMARKS.platforms.airbnb.values);
  }, [metrics.avg]);

  // Properties needing attention (below 7.0)
  const needsAttention = useMemo(() => {
    return properties
      .map(p => {
        const snapshot = snapshots[p.id];
        const score5 = snapshot?.score_raw ?? p.kasa_aggregated_score;
        const score10 = score5 ? Number(score5) * 2 : null;
        const reviewCount = snapshot?.review_count ?? p.kasa_review_count;
        return { ...p, score10, reviewCount };
      })
      .filter(p => p.score10 !== null && p.score10 < 7.0)
      .sort((a, b) => (a.score10 ?? 0) - (b.score10 ?? 0));
  }, [properties, snapshots]);

  // Top performers (9.5+)
  const topPerformers = useMemo(() => {
    return properties
      .map(p => {
        const snapshot = snapshots[p.id];
        const score5 = snapshot?.score_raw ?? p.kasa_aggregated_score;
        const score10 = score5 ? Number(score5) * 2 : null;
        const reviewCount = snapshot?.review_count ?? p.kasa_review_count;
        return { ...p, score10, reviewCount };
      })
      .filter(p => p.score10 !== null && p.score10 >= 9.5)
      .sort((a, b) => (b.score10 ?? 0) - (a.score10 ?? 0));
  }, [properties, snapshots]);

  // Score distribution for histogram - granular 0.5 intervals (filtered to only show ranges with data)
  const distribution = useMemo(() => {
    const ranges = [
      { label: '<6', min: 0, max: 6, count: 0 },
      { label: '6.0-6.5', min: 6, max: 6.5, count: 0 },
      { label: '6.5-7.0', min: 6.5, max: 7, count: 0 },
      { label: '7.0-7.5', min: 7, max: 7.5, count: 0 },
      { label: '7.5-8.0', min: 7.5, max: 8, count: 0 },
      { label: '8.0-8.5', min: 8, max: 8.5, count: 0 },
      { label: '8.5-9.0', min: 8.5, max: 9, count: 0 },
      { label: '9.0-9.5', min: 9, max: 9.5, count: 0 },
      { label: '9.5-10', min: 9.5, max: 10.01, count: 0 },
    ];
    
    metrics.scores.forEach(score => {
      const range = ranges.find(r => score >= r.min && score < r.max);
      if (range) range.count++;
    });
    
    // Filter out ranges with no data
    return ranges.filter(r => r.count > 0);
  }, [metrics.scores]);

  // Generate insights
  const insights = useMemo(() => {
    const strengths: string[] = [];
    const opportunities: string[] = [];
    
    // Count properties by tier
    const veryGoodPlus = metrics.scores.filter(s => s >= 8.0).length;
    const veryGoodPlusPercent = Math.round((veryGoodPlus / metrics.scores.length) * 100);
    
    if (veryGoodPlusPercent >= 90) {
      strengths.push(`${veryGoodPlusPercent}% of properties rated "Very Good" or higher`);
    } else if (veryGoodPlusPercent >= 75) {
      strengths.push(`${veryGoodPlusPercent}% of properties rated "Very Good" or higher`);
    }
    
    if (topPerformers.length > 0) {
      strengths.push(`${topPerformers.length} properties scoring 9.5+ (Exceptional)`);
    }
    
    const excellent = metrics.scores.filter(s => s >= 9).length;
    if (excellent > metrics.scores.length * 0.5) {
      strengths.push(`${Math.round(excellent / metrics.scores.length * 100)}% of properties rate as "Wonderful" or better`);
    }
    
    if (needsAttention.length > 0) {
      opportunities.push(`${needsAttention.length} ${needsAttention.length === 1 ? 'property has' : 'properties have'} clear improvement path`);
    }
    
    const closeToVeryGood = metrics.scores.filter(s => s >= 7.5 && s < 8.0).length;
    if (closeToVeryGood > 0) {
      opportunities.push(`${closeToVeryGood} ${closeToVeryGood === 1 ? 'property' : 'properties'} within reach of "Very Good"`);
    }
    
    // Executive summary - optimistic framing
    let summary = '';
    if (metrics.avg !== null) {
      summary = `Kasa portfolio averages ${metrics.avg.toFixed(2)}/10 across ${metrics.scores.length} properties. `;
      
      if (veryGoodPlusPercent >= 90) {
        summary += `${veryGoodPlusPercent}% rated "Very Good" or higher — exceptional consistency at scale. `;
      } else if (veryGoodPlusPercent >= 75) {
        summary += `${veryGoodPlusPercent}% rated "Very Good" or higher. `;
      }
      
      if (topPerformers.length > 0) {
        summary += `${topPerformers.length} ${topPerformers.length === 1 ? 'property achieves' : 'properties achieve'} "Exceptional" status. `;
      }
      
      if (needsAttention.length === 0) {
        summary += `All properties scoring 7.0 or above.`;
      } else if (needsAttention.length === 1) {
        summary += `1 property on improvement path.`;
      } else {
        summary += `${needsAttention.length} properties on improvement path.`;
      }
    }
    
    return { strengths, opportunities, summary };
  }, [topPerformers, needsAttention, metrics]);

  if (properties.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No Kasa properties to analyze.</p>
        <p className="text-sm mt-1">Import properties from Kasa.com first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 2. Portfolio Scorecard (SWOT) */}
      <SwotAnalysis properties={properties} snapshots={snapshots} />

      {/* 3. Channel Benchmarks */}
      <KasaOTAPlatformCard />
    </div>
  );
}

// Exported separately so Insights page can control ordering
export function KasaGeographicSection({ properties, snapshots }: KasaBenchmarkTabProps) {
  return <GeographicAnalysis properties={properties} snapshots={snapshots} />;
}

export function KasaScoreDistribution({ properties, snapshots }: KasaBenchmarkTabProps) {
  // Calculate portfolio metrics
  const metrics = useMemo(() => {
    const scores: number[] = [];
    properties.forEach(p => {
      const snapshot = snapshots[p.id];
      const score5 = snapshot?.score_raw ?? p.kasa_aggregated_score;
      if (score5 !== null && score5 !== undefined) {
        scores.push(Number(score5) * 2);
      }
    });
    if (scores.length === 0) return { avg: null, median: null, stdDev: null, scores };
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sorted = [...scores].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    const squaredDiffs = scores.map(s => Math.pow(s - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / scores.length;
    const stdDev = Math.sqrt(avgSquaredDiff);
    return { avg, median, stdDev, scores };
  }, [properties, snapshots]);

  const distribution = useMemo(() => {
    const ranges = [
      { label: '<6', min: 0, max: 6, count: 0 },
      { label: '6.0-6.5', min: 6, max: 6.5, count: 0 },
      { label: '6.5-7.0', min: 6.5, max: 7, count: 0 },
      { label: '7.0-7.5', min: 7, max: 7.5, count: 0 },
      { label: '7.5-8.0', min: 7.5, max: 8, count: 0 },
      { label: '8.0-8.5', min: 8, max: 8.5, count: 0 },
      { label: '8.5-9.0', min: 8.5, max: 9, count: 0 },
      { label: '9.0-9.5', min: 9, max: 9.5, count: 0 },
      { label: '9.5-10', min: 9.5, max: 10.01, count: 0 },
    ];
    metrics.scores.forEach(score => {
      const range = ranges.find(r => score >= r.min && score < r.max);
      if (range) range.count++;
    });
    return ranges.filter(r => r.count > 0);
  }, [metrics.scores]);

  if (properties.length === 0) return null;

  return (
    <Collapsible defaultOpen>
      <Card>
        <CardHeader className="cursor-pointer">
          <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
            <div>
              <CardTitle>Score Distribution</CardTitle>
              <CardDescription>
                Statistical breakdown for deep divers
                {metrics.median !== null && metrics.stdDev !== null && (
                  <span className="ml-2 text-foreground">
                    • Median: {metrics.median.toFixed(2)} • Std Dev: {metrics.stdDev.toFixed(2)}
                  </span>
                )}
              </CardDescription>
            </div>
            <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                          <p className="font-medium">{data.label} score range</p>
                          <p className="text-sm text-muted-foreground">{data.count} properties</p>
                        </div>
                      );
                    }}
                  />
                  {metrics.median && (
                    <ReferenceLine 
                      x={distribution.find(d => metrics.median! >= d.min && metrics.median! < d.max)?.label}
                      stroke="hsl(var(--primary))"
                      strokeDasharray="5 5"
                      label={{ value: 'Median', position: 'top', fill: 'hsl(var(--muted-foreground))' }}
                    />
                  )}
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {distribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={
                          entry.min >= 9.5 ? '#059669' :
                          entry.min >= 9 ? '#10b981' :
                          entry.min >= 8 ? '#3b82f6' :
                          entry.min >= 7 ? '#eab308' :
                          entry.min >= 6 ? '#f97316' :
                          '#ef4444'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> &lt;6 Needs Work</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500" /> 6-7 Pleasant</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500" /> 7-8 Good</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> 8-9 Very Good</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" /> 9-9.5 Wonderful</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-600" /> 9.5+ Exceptional</span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
