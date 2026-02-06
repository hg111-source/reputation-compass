import { useMemo, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { getScoreColor } from '@/lib/scoring';
import { Star } from 'lucide-react';

interface PropertyInfo {
  name: string;
  score: number | null;
  reviews: number;
  url?: string | null;
}

interface StateData {
  state: string;
  avgScore: number | null;
  propertyCount: number;
  totalReviews: number;
  properties?: PropertyInfo[];
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

// Softer, more aesthetic color palette
function getMapColor(score: number | null): string {
  if (score === null) return '#f1f5f9'; // slate-100 for no data
  if (score >= 9.5) return '#059669'; // emerald-600
  if (score >= 9) return '#10b981'; // emerald-500
  if (score >= 8) return '#3b82f6'; // blue-500
  if (score >= 7) return '#f59e0b'; // amber-500
  if (score >= 6) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

// Get a lighter version for the glow effect
function getGlowColor(score: number | null): string {
  if (score === null) return 'transparent';
  if (score >= 9.5) return 'rgba(5, 150, 105, 0.4)';
  if (score >= 9) return 'rgba(16, 185, 129, 0.4)';
  if (score >= 8) return 'rgba(59, 130, 246, 0.4)';
  if (score >= 7) return 'rgba(245, 158, 11, 0.4)';
  if (score >= 6) return 'rgba(249, 115, 22, 0.4)';
  return 'rgba(239, 68, 68, 0.4)';
}

// Grid-based cartogram positions (approximating US geography)
const STATE_POSITIONS: Record<string, { x: number; y: number }> = {
  AK: { x: 0, y: 0 }, ME: { x: 10, y: 0 },
  WA: { x: 1, y: 1 }, MT: { x: 3, y: 1 }, ND: { x: 4, y: 1 }, MN: { x: 5, y: 1 }, WI: { x: 6, y: 1 }, MI: { x: 7, y: 1 }, VT: { x: 9, y: 1 }, NH: { x: 10, y: 1 },
  OR: { x: 1, y: 2 }, ID: { x: 2, y: 2 }, WY: { x: 3, y: 2 }, SD: { x: 4, y: 2 }, IA: { x: 5, y: 2 }, IL: { x: 6, y: 2 }, IN: { x: 7, y: 2 }, OH: { x: 8, y: 2 }, NY: { x: 9, y: 2 }, MA: { x: 10, y: 2 }, RI: { x: 11, y: 2 },
  NV: { x: 1, y: 3 }, UT: { x: 2, y: 3 }, CO: { x: 3, y: 3 }, NE: { x: 4, y: 3 }, KS: { x: 5, y: 3 }, MO: { x: 6, y: 3 }, KY: { x: 7, y: 3 }, WV: { x: 8, y: 3 }, PA: { x: 9, y: 3 }, NJ: { x: 10, y: 3 }, CT: { x: 11, y: 3 },
  CA: { x: 0, y: 4 }, AZ: { x: 2, y: 4 }, NM: { x: 3, y: 4 }, OK: { x: 4, y: 4 }, AR: { x: 5, y: 4 }, TN: { x: 6, y: 4 }, VA: { x: 8, y: 4 }, MD: { x: 9, y: 4 }, DE: { x: 10, y: 4 }, DC: { x: 11, y: 4 },
  HI: { x: 0, y: 6 }, TX: { x: 3, y: 5 }, LA: { x: 5, y: 5 }, MS: { x: 6, y: 5 }, AL: { x: 7, y: 5 }, GA: { x: 8, y: 5 }, NC: { x: 9, y: 5 }, SC: { x: 10, y: 5 },
  FL: { x: 9, y: 6 },
};

const CELL_SIZE = 48;
const CELL_GAP = 6;

export function USStateMap({ stateData }: USStateMapProps) {
  const [activeState, setActiveState] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create lookup for state data
  const stateDataMap = useMemo(() => {
    const map = new Map<string, StateData>();
    stateData.forEach(s => {
      const abbrev = Object.entries(STATE_NAMES).find(([_, name]) => name === s.state)?.[0] || s.state;
      map.set(abbrev, s);
    });
    return map;
  }, [stateData]);

  // Calculate property count range for scaling
  const { minCount, maxCount } = useMemo(() => {
    const counts = stateData.filter(s => s.propertyCount > 0).map(s => s.propertyCount);
    return {
      minCount: Math.min(...counts, 1),
      maxCount: Math.max(...counts, 1),
    };
  }, [stateData]);

  // Scale function for circle radius
  const getRadius = (count: number) => {
    const MIN_RADIUS = 14;
    const MAX_RADIUS = 30;
    if (maxCount === minCount) return (MIN_RADIUS + MAX_RADIUS) / 2;
    const scale = (count - minCount) / (maxCount - minCount);
    return MIN_RADIUS + scale * (MAX_RADIUS - MIN_RADIUS);
  };

  // Get all states with their data
  const states = useMemo(() => {
    return Object.entries(STATE_POSITIONS).map(([abbrev, pos]) => {
      const data = stateDataMap.get(abbrev);
      const radius = data ? getRadius(data.propertyCount) : 10;
      return {
        abbrev,
        name: STATE_NAMES[abbrev] || abbrev,
        ...pos,
        data,
        radius,
        color: getMapColor(data?.avgScore ?? null),
        glowColor: getGlowColor(data?.avgScore ?? null),
        hasData: !!data,
      };
    });
  }, [stateDataMap, minCount, maxCount]);

  const activeStateData = activeState ? states.find(s => s.abbrev === activeState) : null;

  // Calculate SVG dimensions
  const maxX = Math.max(...states.map(s => s.x));
  const maxY = Math.max(...states.map(s => s.y));
  const width = (maxX + 1) * (CELL_SIZE + CELL_GAP) + 60;
  const height = (maxY + 1) * (CELL_SIZE + CELL_GAP) + 60;

  return (
    <div className="relative">
      <div className="w-full overflow-x-auto">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full max-w-3xl mx-auto"
          style={{ minWidth: '520px' }}
        >
          {/* Background pattern for map feel */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <rect width={width} height={height} fill="url(#grid)" opacity="0.5" />
          
          {/* State circles */}
          {states.map(state => {
            const cx = state.x * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2 + 30;
            const cy = state.y * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2 + 30;
            const r = state.radius;
                const isHovered = activeState === state.abbrev;
            
            return (
              <g 
                key={state.abbrev}
                className="cursor-pointer"
                onMouseEnter={() => {
                  if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                  }
                  setActiveState(state.abbrev);
                }}
                onMouseLeave={() => {
                  timeoutRef.current = setTimeout(() => {
                    setActiveState(null);
                  }, 150);
                }}
              >
                {/* Glow effect for states with data */}
                {state.hasData && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + (isHovered ? 8 : 4)}
                    fill={state.glowColor}
                    className="transition-all duration-300"
                    style={{ opacity: isHovered ? 0.8 : 0.4 }}
                  />
                )}
                
                {/* Main circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? r + 3 : r}
                  fill={state.color}
                  className="transition-all duration-200"
                  style={{
                    filter: isHovered ? 'brightness(1.1)' : 'none',
                  }}
                />
                
                {/* State abbreviation */}
                <text
                  x={cx}
                  y={cy - (state.data && r >= 20 ? 5 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={cn(
                    'font-bold pointer-events-none transition-all duration-200',
                    state.hasData ? 'fill-white' : 'fill-muted-foreground',
                    r >= 22 ? 'text-[12px]' : r >= 18 ? 'text-[10px]' : 'text-[8px]'
                  )}
                  style={{ 
                    textShadow: state.hasData ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                    fontWeight: isHovered ? 800 : 700
                  }}
                >
                  {state.abbrev}
                </text>
                
                {/* Score inside circle for larger bubbles */}
                {state.data && r >= 20 && (
                  <text
                    x={cx}
                    y={cy + 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[9px] font-semibold fill-white/90 pointer-events-none"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                  >
                    {state.data.avgScore?.toFixed(1)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        
        {/* Legend */}
        <div className="space-y-3 mt-6">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: '#10b981' }} /> 9+ Wonderful
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: '#3b82f6' }} /> 8+ Very Good
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: '#f59e0b' }} /> 7+ Good
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: '#f97316' }} /> 6+ Pleasant
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: '#ef4444' }} /> &lt;6 Needs Work
            </span>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Bubble size = number of properties (not property size) • Hover for details
          </p>
        </div>
      </div>

      {/* Floating tooltip/callout */}
      {activeStateData?.data && (
        <div 
          className="absolute z-50 bg-background/95 backdrop-blur-sm border rounded-xl shadow-xl p-4 min-w-[240px] max-w-[320px] animate-scale-in"
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
            top: '10px',
          }}
          onMouseEnter={() => {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
          }}
          onMouseLeave={() => {
            setActiveState(null);
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-lg">{activeStateData.name}</h4>
            <span 
              className={cn('text-xl font-bold flex items-center gap-1', getScoreColor(activeStateData.data.avgScore))}
            >
              {activeStateData.data.avgScore?.toFixed(2)}
              {activeStateData.data.avgScore && activeStateData.data.avgScore >= 9 && (
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              )}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold">{activeStateData.data.propertyCount}</div>
              <div className="text-xs text-muted-foreground">Properties</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold">{activeStateData.data.totalReviews.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Reviews</div>
            </div>
          </div>
          
          {/* Property list */}
          {activeStateData.data.properties && activeStateData.data.properties.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Properties:</p>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                {activeStateData.data.properties.map((prop, i) => (
                  <div key={i} className="flex items-center justify-between text-sm gap-2">
                    <span className="truncate flex-1" title={prop.name}>
                      {prop.name.replace(/by Kasa$/i, '').trim()}
                    </span>
                    <span className={cn('font-semibold shrink-0 flex items-center gap-0.5', getScoreColor(prop.score))}>
                      {prop.score?.toFixed(1)}
                      {prop.score && prop.score >= 9 && (
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
