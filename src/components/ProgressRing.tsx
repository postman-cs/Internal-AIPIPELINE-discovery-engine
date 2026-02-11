"use client";

/**
 * ProgressRing — Subtle SVG ring for gamification
 *
 * Shows a circular progress indicator with an optional label.
 * Used for project health scores, phase completion, etc.
 */

interface ProgressRingProps {
  value: number;    // 0-100
  size?: number;    // px
  strokeWidth?: number;
  label?: string;
  color?: string;   // CSS color
  showValue?: boolean;
  className?: string;
}

function getColor(value: number, overrideColor?: string): string {
  if (overrideColor) return overrideColor;
  if (value >= 80) return "var(--accent-green)";
  if (value >= 60) return "var(--accent-cyan)";
  if (value >= 40) return "var(--accent-blue)";
  if (value >= 20) return "var(--accent-yellow)";
  return "var(--accent-red)";
}

export function ProgressRing({
  value,
  size = 48,
  strokeWidth = 3,
  label,
  color,
  showValue = true,
  className,
}: ProgressRingProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedValue / 100) * circumference;
  const resolvedColor = getColor(clampedValue, color);

  return (
    <div className={`flex flex-col items-center gap-1 ${className || ""}`}>
      <svg width={size} height={size} className="transform -rotate-90" role="img" aria-label={`${label || "Progress"}: ${Math.round(clampedValue)}%`}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={resolvedColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.8s ease-in-out, stroke 0.3s",
            filter: `drop-shadow(0 0 4px ${resolvedColor})`,
          }}
        />
        {/* Center text */}
        {showValue && (
          <text
            x={size / 2}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill={resolvedColor}
            fontSize={size * 0.22}
            fontWeight="600"
            transform={`rotate(90 ${size / 2} ${size / 2})`}
          >
            {Math.round(clampedValue)}
          </text>
        )}
      </svg>
      {label && (
        <span className="text-[10px] font-medium" style={{ color: "var(--foreground-dim)" }}>
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * PhaseProgressBar — Horizontal bar showing phase completion
 */
export function PhaseProgressBar({
  completed,
  total,
  className,
}: {
  completed: number;
  total: number;
  className?: string;
}) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  const resolvedColor = getColor(pct);

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: resolvedColor,
            boxShadow: `0 0 8px ${resolvedColor}`,
          }}
        />
      </div>
      <span className="text-[10px] tabular-nums font-medium" style={{ color: "var(--foreground-dim)" }}>
        {completed}/{total}
      </span>
    </div>
  );
}
