import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Trophy, Info, AlertTriangle, Star, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScoreColor } from '@/lib/scoring';
import { GeographicAnalysis } from './GeographicAnalysis';
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
    
    if (kasaPercentile !== null) {
      if (kasaPercentile >= 90) {
        strengths.push('Portfolio average ranks in the Top 10% of the industry');
      } else if (kasaPercentile >= 75) {
        strengths.push('Portfolio average ranks in the Top 25% of the industry');
      } else if (kasaPercentile < 50) {
        opportunities.push('Portfolio average is below industry median');
      }
    }
    
    if (topPerformers.length > 0) {
      strengths.push(`${topPerformers.length} properties scoring 9.5+ (Wonderful)`);
    }
    
    const excellent = metrics.scores.filter(s => s >= 9).length;
    if (excellent > metrics.scores.length * 0.5) {
      strengths.push(`${Math.round(excellent / metrics.scores.length * 100)}% of properties rate as "Wonderful"`);
    }
    
    if (needsAttention.length > 0) {
      opportunities.push(`${needsAttention.length} properties scoring below 7.0 need attention`);
    }
    
    const belowAvg = metrics.scores.filter(s => s < 8).length;
    if (belowAvg > 0 && belowAvg < metrics.scores.length) {
      opportunities.push(`${belowAvg} properties below "Very Good" threshold`);
    }
    
    // Executive summary
    let summary = '';
    if (metrics.avg !== null && kasaPercentile !== null) {
      const tier = getPercentileTier(kasaPercentile);
      summary = `Kasa portfolio averages ${metrics.avg.toFixed(2)}/10, ranking in the ${tier.label} of industry benchmarks. `;
      if (topPerformers.length > 0) {
        summary += `${topPerformers.length} properties are top performers. `;
      }
      if (needsAttention.length > 0) {
        summary += `${needsAttention.length} properties need improvement.`;
      }
    }
    
    return { strengths, opportunities, summary };
  }, [kasaPercentile, topPerformers, needsAttention, metrics]);

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
      {/* Executive Summary */}
      {insights.summary && (
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <p className="text-lg font-medium">{insights.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Key Insights Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Strengths */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insights.strengths.length > 0 ? (
              <ul className="space-y-2">
                {insights.strengths.map((strength, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    {strength}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No significant strengths identified</p>
            )}
          </CardContent>
        </Card>

        {/* Opportunities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-500" />
              Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insights.opportunities.length > 0 ? (
              <ul className="space-y-2">
                {insights.opportunities.map((opportunity, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-orange-500 mt-0.5">!</span>
                    {opportunity}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No significant opportunities identified</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Portfolio vs Industry Benchmark */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Portfolio vs Industry Benchmarks</CardTitle>
              <CardDescription>How Kasa compares to industry medians</CardDescription>
            </div>
            {kasaPercentile !== null && (
              <div className="flex items-center gap-2">
                {kasaPercentile >= 90 && <Trophy className="h-6 w-6 text-yellow-500" />}
                <Badge className={cn(getPercentileTier(kasaPercentile).bgColor, getPercentileTier(kasaPercentile).color)}>
                  {getPercentileTier(kasaPercentile).label}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {metrics.avg !== null && kasaPercentile !== null && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Kasa Portfolio Average</span>
                <span className={cn('font-bold', getScoreColor(metrics.avg))}>
                  {metrics.avg.toFixed(2)}/10
                </span>
              </div>
              <div className="relative">
                <Progress value={kasaPercentile} className="h-4" />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-primary-foreground">
                  {kasaPercentile.toFixed(0)}th percentile
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>50% Median</span>
                <span>75%</span>
                <span>90%</span>
                <span>100%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Industry Percentile Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Industry Percentile Thresholds
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Benchmarks derived from industry hospitality data across major booking platforms.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardDescription>
            Score thresholds for each percentile rank
            {metrics.avg !== null && (
              <span className="ml-2 text-foreground font-medium">
                • Kasa avg: {metrics.avg.toFixed(2)}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Percentile</TableHead>
                <TableHead>Rank</TableHead>
                {Object.values(INDUSTRY_BENCHMARKS.platforms).map(platform => (
                  <TableHead key={platform.name} className="text-center">{platform.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {INDUSTRY_BENCHMARKS.percentiles.map((percentile, idx) => {
                const rankLabels: Record<number, string> = {
                  50: 'Top 50%',
                  75: 'Top 25%',
                  90: 'Top 10%',
                  95: 'Top 5%',
                  99: 'Top 1%',
                };
                
                // Check if Kasa falls into this tier (for Airbnb benchmark)
                const airbnbValues = INDUSTRY_BENCHMARKS.platforms.airbnb.values;
                const nextIdx = idx + 1;
                const isKasaTier = metrics.avg !== null && 
                  metrics.avg >= airbnbValues[idx] && 
                  (nextIdx >= airbnbValues.length || metrics.avg < airbnbValues[nextIdx]);
                
                return (
                  <TableRow 
                    key={percentile}
                    className={cn(isKasaTier && 'bg-primary/10 border-l-4 border-l-primary')}
                  >
                    <TableCell className="font-medium">
                      <Badge variant={percentile >= 90 ? 'default' : 'outline'}>
                        {percentile}th
                      </Badge>
                    </TableCell>
                    <TableCell className={cn('font-medium', isKasaTier && 'text-primary')}>
                      {rankLabels[percentile]}
                      {isKasaTier && ' ← Kasa'}
                    </TableCell>
                    {Object.values(INDUSTRY_BENCHMARKS.platforms).map(platform => {
                      const value = platform.values[idx];
                      const isKasaAbove = metrics.avg !== null && metrics.avg >= value;
                      return (
                        <TableCell 
                          key={`${platform.name}-${percentile}`} 
                          className={cn(
                            'text-center',
                            isKasaAbove && 'bg-emerald-50 dark:bg-emerald-900/20 font-semibold'
                          )}
                        >
                          {value.toFixed(2)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="inline-block w-3 h-3 bg-emerald-50 dark:bg-emerald-900/20 border mr-1 align-middle" />
            Kasa exceeds threshold
            <span className="mx-2">•</span>
            <span className="inline-block w-3 h-3 bg-primary/10 border-l-2 border-l-primary mr-1 align-middle" />
            Kasa's current tier (vs Airbnb)
          </p>
        </CardContent>
      </Card>

      {/* Score Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Score Distribution</CardTitle>
          <CardDescription>
            How properties are distributed across score ranges
            {metrics.median !== null && metrics.stdDev !== null && (
              <span className="ml-2 text-foreground">
                • Median: {metrics.median.toFixed(2)} • Std Dev: {metrics.stdDev.toFixed(2)}
              </span>
            )}
          </CardDescription>
        </CardHeader>
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
      </Card>

      {/* Geographic Analysis */}
      <GeographicAnalysis properties={properties} snapshots={snapshots} />

      {/* Top Performers & Needs Attention */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Performers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top Performers
              <Badge variant="secondary">{topPerformers.length}</Badge>
            </CardTitle>
            <CardDescription>Properties scoring 9.5+ (Wonderful)</CardDescription>
          </CardHeader>
          <CardContent>
            {topPerformers.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {topPerformers.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.city}, {p.state}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={cn('font-semibold', getScoreColor(p.score10))}>{p.score10?.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{p.reviewCount?.toLocaleString()} reviews</p>
                      </div>
                      {p.kasa_url && (
                        <a href={p.kasa_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No properties scoring 9.5+ yet</p>
            )}
          </CardContent>
        </Card>

        {/* Needs Attention */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Needs Attention
              <Badge variant="destructive">{needsAttention.length}</Badge>
            </CardTitle>
            <CardDescription>Properties scoring below 7.0</CardDescription>
          </CardHeader>
          <CardContent>
            {needsAttention.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {needsAttention.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.city}, {p.state}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={cn('font-semibold', getScoreColor(p.score10))}>{p.score10?.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{p.reviewCount?.toLocaleString()} reviews</p>
                      </div>
                      {p.kasa_url && (
                        <a href={p.kasa_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-emerald-600 py-4 text-center">🎉 All properties are scoring 7.0 or above!</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
