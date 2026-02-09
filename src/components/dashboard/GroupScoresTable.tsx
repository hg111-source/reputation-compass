import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Property, PropertyWithScores, ReviewSource } from '@/lib/types';
import { REVIEW_SOURCES, calculateWeightedScore, formatScore, getScoreColor } from '@/lib/scoring';
import { SortableTableHead, SortDirection } from '@/components/properties/SortableTableHead';
import { RefreshCw, Trash2, MapPin, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import googleLogo from '@/assets/logos/google.svg';
import tripadvisorLogo from '@/assets/logos/tripadvisor.png';
import bookingLogo from '@/assets/logos/booking.png';
import expediaLogo from '@/assets/logos/expedia.png';

type SortKey = 'name' | 'location' | 'weightedScore' | 'totalReviews' | 'google' | 'tripadvisor' | 'booking' | 'expedia' | null;

interface GroupScoresTableProps {
  properties: Property[];
  scores: Record<string, Record<ReviewSource, { score: number; count: number; updated: string }>>;
  onRefreshProperty: (propertyId: string) => void;
  onRemoveProperty?: (propertyId: string) => void;
  isRefreshing?: boolean;
  hideRemoveButton?: boolean;
}

export function GroupScoresTable({
  properties,
  scores,
  onRefreshProperty,
  onRemoveProperty,
  isRefreshing,
  hideRemoveButton = false,
}: GroupScoresTableProps) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'desc') setSortDirection('asc');
      else if (sortDirection === 'asc') { setSortKey(null); setSortDirection(null); }
    } else {
      setSortKey(key as SortKey);
      setSortDirection('desc');
    }
  }, [sortKey, sortDirection]);

  const propertiesWithScores = useMemo(() => {
    return properties.map(property => {
      const propertyScores = scores[property.id] || {};
      const scoreData: PropertyWithScores['scores'] = {};
      let lastUpdated: string | null = null;
      let totalReviews = 0;

      for (const source of REVIEW_SOURCES) {
        const sourceScore = propertyScores[source];
        if (sourceScore) {
          scoreData[source] = { score: sourceScore.score, count: sourceScore.count };
          totalReviews += sourceScore.count || 0;
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

      const finalWeightedScore = weightedScore ?? (property.kasa_aggregated_score ? (property.kasa_aggregated_score / 5) * 10 : null);
      const finalTotalReviews = totalReviews > 0 ? totalReviews : (property.kasa_review_count ?? 0);

      return {
        ...property,
        scores: scoreData,
        weightedScore: finalWeightedScore,
        totalReviews: finalTotalReviews,
        lastUpdated,
      };
    });
  }, [properties, scores]);

  const sortedProperties = useMemo(() => {
    if (!sortKey || !sortDirection) return propertiesWithScores;
    return [...propertiesWithScores].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'location':
          cmp = `${a.city}, ${a.state}`.localeCompare(`${b.city}, ${b.state}`);
          break;
        case 'weightedScore':
          cmp = (a.weightedScore ?? -1) - (b.weightedScore ?? -1);
          break;
        case 'totalReviews':
          cmp = a.totalReviews - b.totalReviews;
          break;
        case 'google':
        case 'tripadvisor':
        case 'booking':
        case 'expedia':
          cmp = (a.scores[sortKey]?.score ?? -1) - (b.scores[sortKey]?.score ?? -1);
          break;
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });
  }, [propertiesWithScores, sortKey, sortDirection]);

  const handleRowClick = (property: Property, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    const isKasa = !!(property.kasa_url || property.kasa_aggregated_score);
    navigate(isKasa ? '/kasa' : '/properties');
  };

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
    <Card className="shadow-kasa">
      <div className="rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <SortableTableHead sortKey="name" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="py-4 font-semibold text-left sticky left-0 z-20 bg-background">Property</SortableTableHead>
            <SortableTableHead sortKey="location" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="py-4 font-semibold text-left">Location</SortableTableHead>
            <SortableTableHead sortKey="weightedScore" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[110px] py-4 text-center font-semibold">Weighted Avg</SortableTableHead>
            <SortableTableHead sortKey="totalReviews" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[110px] py-4 text-center font-semibold">Total Reviews</SortableTableHead>
            <SortableTableHead sortKey="google" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[90px] py-4 text-center font-semibold">
              <img src={googleLogo} alt="Google" className="h-4 w-4 inline mr-1" />Google
            </SortableTableHead>
            <SortableTableHead sortKey="tripadvisor" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[90px] py-4 text-center font-semibold">
              <img src={tripadvisorLogo} alt="TA" className="h-4 w-4 inline mr-1" />TA
            </SortableTableHead>
            <SortableTableHead sortKey="booking" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[90px] py-4 text-center font-semibold">
              <img src={bookingLogo} alt="Booking" className="h-4 w-4 inline mr-1" />Booking
            </SortableTableHead>
            <SortableTableHead sortKey="expedia" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort} className="w-[90px] py-4 text-center font-semibold">
              <img src={expediaLogo} alt="Expedia" className="h-4 w-4 inline mr-1" />Expedia
            </SortableTableHead>
            <TableHead className="w-[80px] py-4"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedProperties.map(property => {
            const isKasa = !!(property.kasa_url || property.kasa_aggregated_score);
            return (
            <TableRow
              key={property.id}
              className={cn(
                'group cursor-pointer',
                isKasa && 'bg-blue-100/70 dark:bg-blue-950/40'
              )}
              onClick={(e) => handleRowClick(property, e)}
            >
              <TableCell className="py-4 font-medium sticky left-0 z-10 bg-background">
                <div className="flex items-center gap-2">
                  {property.name}
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </TableCell>
              <TableCell className="py-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {property.city}, {property.state}
                </div>
              </TableCell>
              <TableCell className="py-4 text-center">
                <span className={cn('font-bold', getScoreColor(property.weightedScore))}>
                  {formatScore(property.weightedScore)}
                </span>
              </TableCell>
              <TableCell className="py-4 text-center font-medium">
                {property.totalReviews > 0 ? property.totalReviews.toLocaleString() : '—'}
              </TableCell>
              {(['google', 'tripadvisor', 'booking', 'expedia'] as ReviewSource[]).map(platform => {
                const data = property.scores[platform];
                return (
                  <TableCell key={platform} className="py-4 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      {data && data.score != null && data.score > 0 ? (
                        <>
                          <span className={cn('font-semibold', getScoreColor(data.score))}>
                            {formatScore(data.score)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {data.count.toLocaleString()}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                );
              })}
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
                  {onRemoveProperty && !hideRemoveButton && (
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
            );
          })}
        </TableBody>
      </Table>
      </div>
    </Card>
  );
}
