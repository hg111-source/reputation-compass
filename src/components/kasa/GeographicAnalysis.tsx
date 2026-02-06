import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MapPin, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScoreColor } from '@/lib/scoring';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
} from 'recharts';

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

interface GeographicAnalysisProps {
  properties: Property[];
  snapshots: Record<string, KasaSnapshot>;
}

// Get color for score
function getBarColor(score: number): string {
  if (score >= 9.5) return '#059669';
  if (score >= 9) return '#10b981';
  if (score >= 8) return '#3b82f6';
  if (score >= 7) return '#eab308';
  if (score >= 6) return '#f97316';
  return '#ef4444';
}

export function GeographicAnalysis({ properties, snapshots }: GeographicAnalysisProps) {
  // Calculate state-level metrics
  const stateMetrics = useMemo(() => {
    const stateData: Record<string, { scores: number[]; properties: number; totalReviews: number }> = {};
    
    properties.forEach(p => {
      const snapshot = snapshots[p.id];
      const score5 = snapshot?.score_raw ?? p.kasa_aggregated_score;
      const score10 = score5 ? Number(score5) * 2 : null;
      const reviews = snapshot?.review_count ?? p.kasa_review_count ?? 0;
      
      if (!stateData[p.state]) {
        stateData[p.state] = { scores: [], properties: 0, totalReviews: 0 };
      }
      stateData[p.state].properties++;
      stateData[p.state].totalReviews += reviews;
      if (score10 !== null) {
        stateData[p.state].scores.push(score10);
      }
    });
    
    return Object.entries(stateData)
      .map(([state, data]) => ({
        state,
        avgScore: data.scores.length > 0 
          ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length 
          : null,
        propertyCount: data.properties,
        totalReviews: data.totalReviews,
        minScore: data.scores.length > 0 ? Math.min(...data.scores) : null,
        maxScore: data.scores.length > 0 ? Math.max(...data.scores) : null,
      }))
      .filter(s => s.avgScore !== null)
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
  }, [properties, snapshots]);

  // Calculate city-level metrics
  const cityMetrics = useMemo(() => {
    const cityData: Record<string, { state: string; scores: number[]; properties: number; totalReviews: number }> = {};
    
    properties.forEach(p => {
      const snapshot = snapshots[p.id];
      const score5 = snapshot?.score_raw ?? p.kasa_aggregated_score;
      const score10 = score5 ? Number(score5) * 2 : null;
      const reviews = snapshot?.review_count ?? p.kasa_review_count ?? 0;
      const key = `${p.city}, ${p.state}`;
      
      if (!cityData[key]) {
        cityData[key] = { state: p.state, scores: [], properties: 0, totalReviews: 0 };
      }
      cityData[key].properties++;
      cityData[key].totalReviews += reviews;
      if (score10 !== null) {
        cityData[key].scores.push(score10);
      }
    });
    
    return Object.entries(cityData)
      .map(([city, data]) => ({
        city,
        state: data.state,
        avgScore: data.scores.length > 0 
          ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length 
          : null,
        propertyCount: data.properties,
        totalReviews: data.totalReviews,
      }))
      .filter(c => c.avgScore !== null)
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
  }, [properties, snapshots]);

  // Property scatter data - each property as a point
  const scatterData = useMemo(() => {
    return properties
      .map(p => {
        const snapshot = snapshots[p.id];
        const score5 = snapshot?.score_raw ?? p.kasa_aggregated_score;
        const score10 = score5 ? Number(score5) * 2 : null;
        const reviews = snapshot?.review_count ?? p.kasa_review_count ?? 0;
        
        return {
          name: p.name,
          city: p.city,
          state: p.state,
          score: score10,
          reviews,
          location: `${p.city}, ${p.state}`,
        };
      })
      .filter(p => p.score !== null);
  }, [properties, snapshots]);

  // Top and bottom cities for chart
  const topBottomCities = useMemo(() => {
    const top5 = cityMetrics.slice(0, 5);
    const bottom5 = [...cityMetrics].sort((a, b) => (a.avgScore ?? 0) - (b.avgScore ?? 0)).slice(0, 5).reverse();
    return { top5, bottom5 };
  }, [cityMetrics]);

  if (properties.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Geographic Analysis</h2>
      </div>

      {/* State Heatmap Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Performance by State
          </CardTitle>
          <CardDescription>
            {stateMetrics.length} states ranked by average score
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-center">Properties</TableHead>
                  <TableHead className="text-center">Avg Score</TableHead>
                  <TableHead className="text-center">Range</TableHead>
                  <TableHead className="text-right">Reviews</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stateMetrics.map((state, idx) => (
                  <TableRow key={state.state}>
                    <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{state.state}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{state.propertyCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span 
                        className={cn('font-bold px-2 py-1 rounded', getScoreColor(state.avgScore))}
                        style={{ backgroundColor: `${getBarColor(state.avgScore ?? 0)}20` }}
                      >
                        {state.avgScore?.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {state.minScore?.toFixed(1)} - {state.maxScore?.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {state.totalReviews.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Top & Bottom Cities */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Cities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-emerald-600">🏆 Top 5 Cities</CardTitle>
            <CardDescription>Highest average scores</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={topBottomCities.top5} 
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <XAxis type="number" domain={[6, 10]} tickCount={5} />
                  <YAxis 
                    type="category" 
                    dataKey="city" 
                    width={75}
                    tick={{ fontSize: 11 }}
                  />
                  <RechartsTooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                          <p className="font-medium">{data.city}</p>
                          <p className="text-sm">Score: <span className={getScoreColor(data.avgScore)}>{data.avgScore?.toFixed(2)}</span></p>
                          <p className="text-xs text-muted-foreground">{data.propertyCount} properties • {data.totalReviews.toLocaleString()} reviews</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="avgScore" radius={[0, 4, 4, 0]}>
                    {topBottomCities.top5.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.avgScore ?? 0)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Cities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-orange-600">⚠️ Bottom 5 Cities</CardTitle>
            <CardDescription>Lowest average scores - improvement opportunities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={topBottomCities.bottom5} 
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <XAxis type="number" domain={[6, 10]} tickCount={5} />
                  <YAxis 
                    type="category" 
                    dataKey="city" 
                    width={75}
                    tick={{ fontSize: 11 }}
                  />
                  <RechartsTooltip 
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                          <p className="font-medium">{data.city}</p>
                          <p className="text-sm">Score: <span className={getScoreColor(data.avgScore)}>{data.avgScore?.toFixed(2)}</span></p>
                          <p className="text-xs text-muted-foreground">{data.propertyCount} properties • {data.totalReviews.toLocaleString()} reviews</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="avgScore" radius={[0, 4, 4, 0]}>
                    {topBottomCities.bottom5.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.avgScore ?? 0)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Property Scatter by Location */}
      <Card>
        <CardHeader>
          <CardTitle>Property Scores by City</CardTitle>
          <CardDescription>
            Each dot represents a property • Bubble size = review count • Hover for details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
                <XAxis 
                  type="category" 
                  dataKey="city" 
                  name="City"
                  allowDuplicatedCategory={false}
                  tick={{ fontSize: 10 }}
                  height={60}
                  interval={0}
                />
                <YAxis 
                  type="number" 
                  dataKey="score" 
                  name="Score" 
                  domain={[6, 10]}
                  tickCount={5}
                />
                <ZAxis 
                  type="number" 
                  dataKey="reviews" 
                  range={[50, 400]} 
                  name="Reviews"
                />
                <RechartsTooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border rounded-lg p-2 shadow-lg max-w-xs">
                        <p className="font-medium truncate">{data.name}</p>
                        <p className="text-sm text-muted-foreground">{data.location}</p>
                        <p className="text-sm">Score: <span className={cn('font-bold', getScoreColor(data.score))}>{data.score?.toFixed(2)}</span></p>
                        <p className="text-xs text-muted-foreground">{data.reviews?.toLocaleString()} reviews</p>
                      </div>
                    );
                  }}
                />
                <Scatter 
                  name="Properties" 
                  data={scatterData.slice(0, 30)} // Limit for readability
                  fill="hsl(var(--primary))"
                >
                  {scatterData.slice(0, 30).map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={getBarColor(entry.score ?? 0)}
                      fillOpacity={0.7}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Showing {Math.min(30, scatterData.length)} of {scatterData.length} properties
          </p>
        </CardContent>
      </Card>

      {/* City Breakdown Full Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Cities Breakdown</CardTitle>
          <CardDescription>Complete city-by-city performance ({cityMetrics.length} cities)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-center">Props</TableHead>
                  <TableHead className="text-center">Avg Score</TableHead>
                  <TableHead className="text-right">Reviews</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cityMetrics.map((city, idx) => (
                  <TableRow key={city.city}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{city.city.split(',')[0]}</TableCell>
                    <TableCell className="text-muted-foreground">{city.state}</TableCell>
                    <TableCell className="text-center">{city.propertyCount}</TableCell>
                    <TableCell className="text-center">
                      <span className={cn('font-semibold', getScoreColor(city.avgScore))}>
                        {city.avgScore?.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {city.totalReviews.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
