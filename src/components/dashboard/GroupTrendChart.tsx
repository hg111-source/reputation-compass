import { useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GroupSnapshot } from '@/lib/types';
import { getScoreColor } from '@/lib/scoring';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface GroupTrendChartProps {
  snapshots: GroupSnapshot[];
}

const TREND_THRESHOLD = 0.05;

export function GroupTrendChart({ snapshots }: GroupTrendChartProps) {
  const chartData = useMemo(() => {
    // Sort chronologically (oldest first for chart)
    return [...snapshots]
      .sort((a, b) => new Date(a.collected_at).getTime() - new Date(b.collected_at).getTime())
      .map(s => ({
        date: s.collected_at,
        score: Number(s.weighted_score_0_10),
        formattedDate: format(new Date(s.collected_at), 'MMM d'),
        fullDate: format(new Date(s.collected_at), 'MMM d, yyyy h:mm a'),
      }));
  }, [snapshots]);

  const trend = useMemo(() => {
    if (chartData.length < 2) return null;
    const latest = chartData[chartData.length - 1].score;
    const previous = chartData[chartData.length - 2].score;
    const diff = latest - previous;
    
    if (diff > TREND_THRESHOLD) return { icon: TrendingUp, color: 'text-emerald-500', label: 'Improving' };
    if (diff < -TREND_THRESHOLD) return { icon: TrendingDown, color: 'text-red-500', label: 'Declining' };
    return { icon: Minus, color: 'text-muted-foreground', label: 'Stable' };
  }, [chartData]);

  if (snapshots.length === 0) {
    return (
      <Card className="shadow-kasa">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-accent" />
            Group Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <p>No trend data yet. Refresh scores to start tracking.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (snapshots.length === 1) {
    const score = chartData[0].score;
    return (
      <Card className="shadow-kasa">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-accent" />
            Group Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 flex-col items-center justify-center gap-2">
            <span className={cn('text-4xl font-bold', getScoreColor(score))}>
              {score.toFixed(1)}
            </span>
            <p className="text-sm text-muted-foreground">
              Only one data point. Refresh again to see trends.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-kasa">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-accent" />
            Group Trend
          </CardTitle>
          {trend && (
            <div className={cn('flex items-center gap-1 text-sm font-medium', trend.color)}>
              <trend.icon className="h-4 w-4" />
              <span>{trend.label}</span>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Portfolio weighted average score over time
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
              <XAxis
                dataKey="formattedDate"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 10]}
                ticks={[0, 2, 4, 6, 8, 10]}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <p className="text-xs text-muted-foreground">{data.fullDate}</p>
                      <p className={cn('text-lg font-bold', getScoreColor(data.score))}>
                        {data.score.toFixed(1)}
                      </p>
                    </div>
                  );
                }}
              />
              {/* Reference lines for score thresholds */}
              <ReferenceLine y={8} stroke="hsl(var(--accent))" strokeDasharray="5 5" opacity={0.3} />
              <ReferenceLine y={6} stroke="hsl(var(--warning))" strokeDasharray="5 5" opacity={0.3} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--accent))"
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--accent))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: 'hsl(var(--accent))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
