import { cn } from "@/lib/utils";

type PerfTier = "excellent" | "good" | "average" | "below" | "poor";

const TIER_COLORS: Record<PerfTier, string> = {
  excellent: "text-[var(--perf-excellent)]",
  good: "text-[var(--perf-good)]",
  average: "text-[var(--perf-average)]",
  below: "text-[var(--perf-below)]",
  poor: "text-[var(--perf-poor)]",
};

interface StatPillProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tier?: PerfTier;
  className?: string;
}

export function StatPill({
  label,
  value,
  unit,
  icon: Icon,
  tier,
  className,
}: StatPillProps) {
  return (
    <div
      className={cn(
        "surface-3 rounded-xl border border-[var(--border-subtle)] p-4",
        className
      )}
    >
      {Icon && (
        <Icon className="mb-2 h-4 w-4 text-primary/50" />
      )}
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "text-mono text-xl font-bold",
            tier ? TIER_COLORS[tier] : "text-white"
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs text-muted-foreground">{unit}</span>
        )}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
