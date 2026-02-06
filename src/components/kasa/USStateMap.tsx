import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getScoreColor } from '@/lib/scoring';

interface StateData {
  state: string;
  avgScore: number | null;
  propertyCount: number;
  totalReviews: number;
}

interface USStateMapProps {
  stateData: StateData[];
}

// State abbreviation to full name mapping
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia'
};

// Get color based on score
function getMapColor(score: number | null): string {
  if (score === null) return '#e5e7eb'; // gray-200 for no data
  if (score >= 9.5) return '#059669'; // emerald-600
  if (score >= 9) return '#10b981'; // emerald-500
  if (score >= 8) return '#3b82f6'; // blue-500
  if (score >= 7) return '#eab308'; // yellow-500
  if (score >= 6) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

// Simplified US state paths (using approximate rectangles positioned geographically)
// This is a simplified grid-based cartogram for clarity
const STATE_POSITIONS: Record<string, { x: number; y: number }> = {
  // Row 1
  AK: { x: 0, y: 0 }, ME: { x: 10, y: 0 },
  // Row 2
  WA: { x: 1, y: 1 }, MT: { x: 3, y: 1 }, ND: { x: 5, y: 1 }, MN: { x: 6, y: 1 }, WI: { x: 7, y: 1 }, MI: { x: 8, y: 1 }, VT: { x: 9, y: 1 }, NH: { x: 10, y: 1 },
  // Row 3
  OR: { x: 1, y: 2 }, ID: { x: 2, y: 2 }, WY: { x: 3, y: 2 }, SD: { x: 5, y: 2 }, IA: { x: 6, y: 2 }, IL: { x: 7, y: 2 }, IN: { x: 8, y: 2 }, NY: { x: 9, y: 2 }, MA: { x: 10, y: 2 },
  // Row 4
  NV: { x: 1, y: 3 }, UT: { x: 2, y: 3 }, CO: { x: 3, y: 3 }, NE: { x: 5, y: 3 }, KS: { x: 6, y: 3 }, MO: { x: 7, y: 3 }, OH: { x: 8, y: 3 }, PA: { x: 9, y: 3 }, NJ: { x: 10, y: 3 }, CT: { x: 11, y: 3 }, RI: { x: 11, y: 2 },
  // Row 5
  CA: { x: 0, y: 4 }, AZ: { x: 2, y: 4 }, NM: { x: 3, y: 4 }, OK: { x: 5, y: 4 }, AR: { x: 6, y: 4 }, KY: { x: 7, y: 4 }, WV: { x: 8, y: 4 }, VA: { x: 9, y: 4 }, MD: { x: 10, y: 4 }, DE: { x: 11, y: 4 },
  // Row 6
  HI: { x: 0, y: 6 }, TX: { x: 4, y: 5 }, LA: { x: 6, y: 5 }, MS: { x: 7, y: 5 }, TN: { x: 7, y: 4.5 }, NC: { x: 9, y: 5 }, SC: { x: 9, y: 5.5 }, DC: { x: 10, y: 5 },
  // Row 7
  AL: { x: 7, y: 6 }, GA: { x: 8, y: 6 }, FL: { x: 9, y: 7 },
};

const CELL_SIZE = 44;
const CELL_GAP = 4;

export function USStateMap({ stateData }: USStateMapProps) {
  // Create lookup for state data
  const stateDataMap = useMemo(() => {
    const map = new Map<string, StateData>();
    stateData.forEach(s => {
      // Handle both abbreviations and full names
      const abbrev = Object.entries(STATE_NAMES).find(([_, name]) => name === s.state)?.[0] || s.state;
      map.set(abbrev, s);
    });
    return map;
  }, [stateData]);

  // Get all states with their data
  const states = useMemo(() => {
    return Object.entries(STATE_POSITIONS).map(([abbrev, pos]) => {
      const data = stateDataMap.get(abbrev);
      return {
        abbrev,
        name: STATE_NAMES[abbrev] || abbrev,
        ...pos,
        data,
        color: getMapColor(data?.avgScore ?? null),
        hasData: !!data,
      };
    });
  }, [stateDataMap]);

  // Calculate SVG dimensions
  const maxX = Math.max(...states.map(s => s.x));
  const maxY = Math.max(...states.map(s => s.y));
  const width = (maxX + 1) * (CELL_SIZE + CELL_GAP) + 20;
  const height = (maxY + 1) * (CELL_SIZE + CELL_GAP) + 20;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="w-full overflow-x-auto">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full max-w-3xl mx-auto"
          style={{ minWidth: '500px' }}
        >
          {states.map(state => {
            const x = state.x * (CELL_SIZE + CELL_GAP) + 10;
            const y = state.y * (CELL_SIZE + CELL_GAP) + 10;
            
            return (
              <Tooltip key={state.abbrev}>
                <TooltipTrigger asChild>
                  <g className="cursor-pointer transition-transform hover:scale-105">
                    <rect
                      x={x}
                      y={y}
                      width={CELL_SIZE}
                      height={CELL_SIZE}
                      rx={6}
                      fill={state.color}
                      stroke={state.hasData ? 'hsl(var(--foreground))' : '#d1d5db'}
                      strokeWidth={state.hasData ? 1.5 : 0.5}
                      className="transition-all duration-200"
                    />
                    <text
                      x={x + CELL_SIZE / 2}
                      y={y + CELL_SIZE / 2 - 4}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-[11px] font-bold fill-white"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                    >
                      {state.abbrev}
                    </text>
                    {state.data && (
                      <text
                        x={x + CELL_SIZE / 2}
                        y={y + CELL_SIZE / 2 + 10}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-[9px] font-semibold fill-white"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                      >
                        {state.data.avgScore?.toFixed(1)}
                      </text>
                    )}
                  </g>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-semibold">{state.name}</p>
                    {state.data ? (
                      <>
                        <p className="text-sm">
                          Score: <span className={cn('font-bold', getScoreColor(state.data.avgScore))}>
                            {state.data.avgScore?.toFixed(2)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {state.data.propertyCount} properties • {state.data.totalReviews.toLocaleString()} reviews
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">No properties</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </svg>
        
        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-3 mt-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded" style={{ backgroundColor: '#059669' }} /> 9.5+ Exceptional
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }} /> 9+ Wonderful
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }} /> 8+ Very Good
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }} /> 7+ Good
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded" style={{ backgroundColor: '#f97316' }} /> 6+ Pleasant
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }} /> &lt;6 Needs Work
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: '#e5e7eb' }} /> No Data
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}
