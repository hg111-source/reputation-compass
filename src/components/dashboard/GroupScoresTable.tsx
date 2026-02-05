import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScoreCell } from './ScoreCell';
import { Property, PropertyWithScores, ReviewSource } from '@/lib/types';
import { REVIEW_SOURCES, SOURCE_LABELS, calculateWeightedScore, formatScore, getScoreColor } from '@/lib/scoring';
import { RefreshCw, Trash2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface GroupScoresTableProps {
  properties: Property[];
  scores: Record<string, Record<ReviewSource, { score: number; count: number; updated: string }>>;
  onRefreshProperty: (propertyId: string) => void;
  onRemoveProperty?: (propertyId: string) => void;
  isRefreshing?: boolean;
}

export function GroupScoresTable({
  properties,
  scores,
  onRefreshProperty,
  onRemoveProperty,
  isRefreshing,
}: GroupScoresTableProps) {
  const propertiesWithScores: PropertyWithScores[] = useMemo(() => {
    return properties.map(property => {
      const propertyScores = scores[property.id] || {};
      const scoreData: PropertyWithScores['scores'] = {};
      let lastUpdated: string | null = null;

      for (const source of REVIEW_SOURCES) {
        const sourceScore = propertyScores[source];
        if (sourceScore) {
          scoreData[source] = { score: sourceScore.score, count: sourceScore.count };
          if (!lastUpdated || sourceScore.updated > lastUpdated) {
            lastUpdated = sourceScore.updated;
          }
        }
      }

      const weightedScore = calculateWeightedScore(
        REVIEW_SOURCES.map(source => ({
          normalized: propertyScores[source]?.score || 0,
          count: propertyScores[source]?.count || 0,
        }))
      );

      return {
        ...property,
        scores: scoreData,
        weightedScore,
        lastUpdated,
      };
    });
  }, [properties, scores]);

  const groupWeightedScore = useMemo(() => {
    const allScores = propertiesWithScores.flatMap(p =>
      REVIEW_SOURCES.map(source => ({
        normalized: p.scores[source]?.score || 0,
        count: p.scores[source]?.count || 0,
      }))
    );
    return calculateWeightedScore(allScores);
  }, [propertiesWithScores]);

  if (properties.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center shadow-kasa">
        <p className="text-lg text-muted-foreground">No properties in this group yet.</p>
        <p className="mt-2 text-muted-foreground">
          Add properties from the Groups page.
        </p>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden shadow-kasa">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-[220px] py-4 font-semibold">Property</TableHead>
            <TableHead className="w-[160px] py-4 font-semibold">Location</TableHead>
            {REVIEW_SOURCES.map(source => (
              <TableHead key={source} className="w-[110px] py-4 text-center font-semibold">
                {SOURCE_LABELS[source]}
              </TableHead>
            ))}
            <TableHead className="w-[110px] py-4 text-center font-semibold">Weighted</TableHead>
            <TableHead className="w-[140px] py-4 font-semibold">Updated</TableHead>
            <TableHead className="w-[90px] py-4"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {propertiesWithScores.map(property => (
            <TableRow key={property.id} className="group">
              <TableCell className="py-4 font-medium">{property.name}</TableCell>
              <TableCell className="py-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {property.city}, {property.state}
                </div>
              </TableCell>
              {REVIEW_SOURCES.map(source => (
                <TableCell key={source} className="py-4">
                  <ScoreCell
                    score={property.scores[source]?.score}
                    count={property.scores[source]?.count}
                  />
                </TableCell>
              ))}
              <TableCell className="py-4">
                <ScoreCell score={property.weightedScore} showCount={false} isWeighted />
              </TableCell>
              <TableCell className="py-4 text-sm text-muted-foreground">
                {property.lastUpdated
                  ? format(new Date(property.lastUpdated), 'MMM d, h:mm a')
                  : '—'}
              </TableCell>
              <TableCell className="py-4">
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    onClick={() => onRefreshProperty(property.id)}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                  </Button>
                  {onRemoveProperty && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveProperty(property.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
