import { useMemo } from 'react';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScoreColor } from '@/lib/scoring';
import { SourceSnapshot, ReviewSource } from '@/lib/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const PLATFORM_COLORS: Record<ReviewSource, string> = {
  google: 'hsl(142, 71%, 45%)', // Google green
  tripadvisor: 'hsl(139, 100%, 28%)', // TripAdvisor green
  booking: 'hsl(213, 94%, 43%)', // Booking blue
  expedia: 'hsl(45, 100%, 51%)', // Expedia gold
  kasa: 'hsl(280, 70%, 50%)', // Kasa purple
};

interface PropertyTrendChartProps {
  snapshots: SourceSnapshot[];
}

interface ChartDataPoint {
  date: string;
  formattedDate: string;
  fullDate: string;
  google?: number;
  tripadvisor?: number;
  booking?: number;
  expedia?: number;
  weighted?: number;
}

export function PropertyTrendChart({ snapshots }: PropertyTrendChartProps) {
  const chartData = useMemo(() => {
    if (snapshots.length === 0) return [];

    // Group by date
    const dateGroups: Record<string, ChartDataPoint> = {};

    for (const snapshot of snapshots) {
      const dateKey = new Date(snapshot.collected_at).toDateString();
      
      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = {
          date: snapshot.collected_at,
          formattedDate: format(new Date(snapshot.collected_at), 'MMM d'),
          fullDate: format(new Date(snapshot.collected_at), 'MMM d, yyyy'),
        };
      }

      if (snapshot.normalized_score_0_10 !== null && snapshot.status === 'found') {
        dateGroups[dateKey][snapshot.source as ReviewSource] = snapshot.normalized_score_0_10;
      }
    }

    // Calculate weighted average for each date
    const dataPoints = Object.values(dateGroups).map(point => {
      let totalPoints = 0;
      let totalReviews = 0;

      // Find reviews for this date
      for (const snapshot of snapshots) {
        const snapshotDate = new Date(snapshot.collected_at).toDateString();
        const pointDate = new Date(point.date).toDateString();
        
        if (snapshotDate === pointDate && snapshot.normalized_score_0_10 !== null && snapshot.status === 'found') {
          totalPoints += snapshot.normalized_score_0_10 * snapshot.review_count;
          totalReviews += snapshot.review_count;
        }
      }

      return {
        ...point,
        weighted: totalReviews > 0 ? totalPoints / totalReviews : undefined,
      };
    });

    // Sort chronologically
    return dataPoints.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [snapshots]);

  if (chartData.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground">
        <p>Need at least 2 data points to show trend chart</p>
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 10]}
            ticks={[0, 2, 4, 6, 8, 10]}
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0].payload as ChartDataPoint;
              return (
                <div className="rounded-lg border bg-background p-3 shadow-lg text-sm">
                  <p className="text-xs text-muted-foreground mb-2">{data.fullDate}</p>
                  {payload.map((entry: any) => (
                    <div key={entry.dataKey} className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="capitalize">{entry.dataKey}:</span>
                      <span className={cn('font-semibold', getScoreColor(entry.value))}>
                        {entry.value?.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Legend 
            verticalAlign="top" 
            height={36}
            formatter={(value) => (
              <span className="text-xs capitalize">{value}</span>
            )}
          />
          <Line
            type="monotone"
            dataKey="weighted"
            name="Weighted Avg"
            stroke="hsl(var(--accent))"
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="google"
            name="Google"
            stroke={PLATFORM_COLORS.google}
            strokeWidth={1.5}
            dot={{ r: 2 }}
            strokeDasharray="5 5"
          />
          <Line
            type="monotone"
            dataKey="tripadvisor"
            name="TripAdvisor"
            stroke={PLATFORM_COLORS.tripadvisor}
            strokeWidth={1.5}
            dot={{ r: 2 }}
            strokeDasharray="5 5"
          />
          <Line
            type="monotone"
            dataKey="booking"
            name="Booking"
            stroke={PLATFORM_COLORS.booking}
            strokeWidth={1.5}
            dot={{ r: 2 }}
            strokeDasharray="5 5"
          />
          <Line
            type="monotone"
            dataKey="expedia"
            name="Expedia"
            stroke={PLATFORM_COLORS.expedia}
            strokeWidth={1.5}
            dot={{ r: 2 }}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
