"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface RadarChartDataPoint {
  competency_id: string;
  competency_name: string;
  mastery_level_order: number | null;
  mastery_level_label: string | null;
}

interface MasteryRadarChartProps {
  data: RadarChartDataPoint[];
  historicalData?: RadarChartDataPoint[][]; // Optional: multiple snapshots to show progress over time
  maxLevels?: number; // Maximum number of mastery levels (for scaling)
  size?: number; // Chart size in pixels
  showProgress?: boolean; // Whether to show historical snapshots as additional lines
}

/**
 * Mastery Radar Chart Component
 * 
 * Uses mastery_level.display_order for ordinal positioning.
 * If display_order is not available, the chart will not render numeric values.
 * 
 * This is a simple SVG-based radar chart that shows competency mastery levels
 * using ordinal positions from the mastery model.
 */
export function MasteryRadarChart({
  data,
  historicalData = [],
  maxLevels = 5,
  size = 400,
  showProgress = false,
}: MasteryRadarChartProps) {
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size * 0.35;

  // Filter out data points without valid mastery level order
  const validData = useMemo(() => {
    return data.filter((d) => d.mastery_level_order !== null && d.mastery_level_order !== undefined);
  }, [data]);

  // If no valid data, show message
  if (validData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mastery Radar Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No mastery data available with valid level ordering.
            <br />
            <span className="text-xs">
              Radar chart requires mastery levels with display_order values.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate angle step for each competency
  const angleStep = (2 * Math.PI) / validData.length;

  // Calculate points for the radar chart
  const points = useMemo(() => {
    return validData.map((point, index) => {
      const angle = index * angleStep - Math.PI / 2; // Start from top
      const levelOrder = point.mastery_level_order || 1;
      // Normalize to 0-1 range (assuming maxLevels is the max)
      const normalizedValue = Math.min(levelOrder / maxLevels, 1);
      const distance = radius * normalizedValue;
      const x = centerX + distance * Math.cos(angle);
      const y = centerY + distance * Math.sin(angle);
      return {
        x,
        y,
        angle,
        distance,
        competency: point.competency_name,
        level: point.mastery_level_label,
        levelOrder,
      };
    });
  }, [validData, angleStep, radius, centerX, centerY, maxLevels]);

  // Create polygon path for current data
  const polygonPath = useMemo(() => {
    if (points.length === 0) return "";
    const path = points.map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      return `L ${p.x} ${p.y}`;
    });
    return `${path.join(" ")} Z`;
  }, [points]);

  // Create polygon paths for historical data (progress visualization)
  const historicalPaths = useMemo(() => {
    if (!showProgress || !historicalData || historicalData.length === 0) return [];
    
    return historicalData.map((historicalPoints, idx) => {
      // Map historical data to same competencies as current data
      const mappedPoints = validData.map((currentPoint, i) => {
        const historicalPoint = historicalPoints.find(
          (hp) => hp.competency_id === currentPoint.competency_id
        );
        
        if (!historicalPoint || historicalPoint.mastery_level_order === null) {
          // Use current point if no historical data for this competency
          return points[i];
        }
        
        const angle = points[i].angle; // Use same angle as current data
        const levelOrder = historicalPoint.mastery_level_order || 1;
        const normalizedValue = Math.min(levelOrder / maxLevels, 1);
        const distance = radius * normalizedValue;
        const x = centerX + distance * Math.cos(angle);
        const y = centerY + distance * Math.sin(angle);
        
        return { x, y, angle, distance };
      });
      
      const path = mappedPoints.map((p, i) => {
        if (i === 0) return `M ${p.x} ${p.y}`;
        return `L ${p.x} ${p.y}`;
      });
      
      return {
        path: `${path.join(" ")} Z`,
        opacity: Math.max(0.3 - (idx * 0.1), 0.1), // Fade older snapshots
        color: `hsl(${220 - idx * 20}, 70%, 60%)`, // Different color for each snapshot
      };
    });
  }, [showProgress, historicalData, validData, points, radius, centerX, centerY, maxLevels]);

  // Create grid circles (concentric circles for reference)
  const gridCircles = useMemo(() => {
    const circles = [];
    for (let i = 1; i <= maxLevels; i++) {
      const normalizedRadius = (radius * i) / maxLevels;
      circles.push(normalizedRadius);
    }
    return circles;
  }, [radius, maxLevels]);

  // Create axis lines
  const axisLines = useMemo(() => {
    return points.map((point) => ({
      x1: centerX,
      y1: centerY,
      x2: centerX + radius * Math.cos(point.angle),
      y2: centerY + radius * Math.sin(point.angle),
      label: point.competency,
      angle: point.angle,
    }));
  }, [points, centerX, centerY, radius]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mastery Radar Chart</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <svg width={size} height={size} className="overflow-visible">
            {/* Grid circles */}
            {gridCircles.map((r, i) => (
              <circle
                key={i}
                cx={centerX}
                cy={centerY}
                r={r}
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-muted-foreground opacity-30"
              />
            ))}

            {/* Axis lines */}
            {axisLines.map((line, i) => (
              <line
                key={i}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-muted-foreground opacity-30"
              />
            ))}

            {/* Historical data polygons (progress lines) - drawn first so current is on top */}
            {historicalPaths.map((histPath, idx) => (
              <path
                key={`historical-${idx}`}
                d={histPath.path}
                fill={histPath.color}
                fillOpacity={histPath.opacity * 0.3}
                stroke={histPath.color}
                strokeWidth="1.5"
                strokeDasharray="4,2"
              />
            ))}

            {/* Current data polygon */}
            {polygonPath && (
              <path
                d={polygonPath}
                fill="currentColor"
                fillOpacity="0.2"
                stroke="currentColor"
                strokeWidth="2"
                className="text-primary"
              />
            )}

            {/* Data points */}
            {points.map((point, i) => (
              <g key={i}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill="currentColor"
                  className="text-primary"
                />
                {/* Label */}
                <text
                  x={centerX + (radius + 20) * Math.cos(point.angle)}
                  y={centerY + (radius + 20) * Math.sin(point.angle)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs fill-foreground"
                  style={{
                    transform: `rotate(${(point.angle * 180) / Math.PI}deg)`,
                    transformOrigin: `${centerX + (radius + 20) * Math.cos(point.angle)}px ${centerY + (radius + 20) * Math.sin(point.angle)}px`,
                  }}
                >
                  {point.competency.length > 15
                    ? point.competency.substring(0, 15) + "..."
                    : point.competency}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-6 space-y-2">
          <div className="text-sm font-medium mb-2">Competency Mastery Levels:</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {validData.map((point, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="truncate">{point.competency_name}</span>
                <span className="text-muted-foreground">
                  ({point.mastery_level_label || "N/A"})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="mt-4 text-xs text-muted-foreground text-center">
          Chart uses mastery level display_order for ordinal positioning.
          Distance from center represents mastery level order (1 = closest, {maxLevels} = farthest).
        </div>
      </CardContent>
    </Card>
  );
}
