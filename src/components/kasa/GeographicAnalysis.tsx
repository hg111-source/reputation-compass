import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Map } from 'lucide-react';
import { USStateMap } from './USStateMap';

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

export function GeographicAnalysis({ properties, snapshots }: GeographicAnalysisProps) {
  // Calculate state-level metrics with property details
  const stateMetrics = useMemo(() => {
    const stateData: Record<string, { 
      scores: number[]; 
      properties: number; 
      totalReviews: number;
      propertyList: Array<{ name: string; score: number | null; reviews: number; url?: string | null }>;
    }> = {};
    
    properties.forEach(p => {
      const snapshot = snapshots[p.id];
      const score5 = snapshot?.score_raw ?? p.kasa_aggregated_score;
      const score10 = score5 ? Number(score5) * 2 : null;
      const reviews = snapshot?.review_count ?? p.kasa_review_count ?? 0;
      
      if (!stateData[p.state]) {
        stateData[p.state] = { scores: [], properties: 0, totalReviews: 0, propertyList: [] };
      }
      stateData[p.state].properties++;
      stateData[p.state].totalReviews += reviews;
      stateData[p.state].propertyList.push({
        name: p.name,
        score: score10,
        reviews,
        url: p.kasa_url,
      });
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
        properties: data.propertyList.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
      }))
      .filter(s => s.avgScore !== null)
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
  }, [properties, snapshots]);

  if (properties.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Geographic Analysis</h2>
      </div>

      {/* US State Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            Performance by State
          </CardTitle>
          <CardDescription>
            Hover over states to see details • {stateMetrics.length} states with properties
          </CardDescription>
        </CardHeader>
        <CardContent>
          <USStateMap stateData={stateMetrics} />
        </CardContent>
      </Card>

    </div>
  );
}
