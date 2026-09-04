"use client";

import {
  MUSCLE_REGION_LABELS,
  muscleHeatFill,
  muscleHeatOpacity,
  muscleHeatStroke,
  type MuscleHeatLevel,
  type MuscleRegion,
  type WorkoutMuscleBreakdown,
} from "@/lib/exerciseMuscles";

type Props = {
  breakdown: WorkoutMuscleBreakdown;
  className?: string;
  size?: "sm" | "md";
  /** When false, only the body SVGs render (use with MuscleChips below). */
  showLegend?: boolean;
};

/** SVG paths overlaid on the grey silhouette — keyed by MuscleRegion. */
const REGION_PATHS: Record<
  MuscleRegion,
  { front?: string; back?: string }
> = {
  chest: {
    front:
      "M46 52c4-6 10-10 18-10s14 4 18 10c2 4 3 9 2 14-1 6-4 11-9 14-3 2-7 3-11 3s-8-1-11-3c-5-3-8-8-9-14-1-5 0-10 2-14z",
  },
  shoulders: {
    front:
      "M28 48c-5 1-9 5-10 11-1 5 1 10 5 13 3 2 6 2 9 1 2-4 3-9 3-14 0-4-2-8-7-11zm72 0c5 1 9 5 10 11 1 5-1 10-5 13-3 2-6 2-9 1-2-4-3-9-3-14 0-4 2-8 7-11z",
  },
  biceps: {
    front:
      "M24 72c-2 8-2 16 0 24 1 4 3 7 6 8 2-8 3-16 2-24-1-4-3-7-8-8zm80 0c2 8 2 16 0 24-1 4-3 7-6 8-2-8-3-16-2-24 1-4 3-7 8-8z",
  },
  triceps: {
    back:
      "M26 74c-2 9-1 18 1 26 2 3 4 5 7 5 1-9 1-18-1-26-1-3-3-5-7-5zm76 0c2 9 1 18-1 26-2 3-4 5-7 5-1-9-1-18 1-26 1-3 3-5 7-5z",
  },
  forearms: {
    front:
      "M22 102c-2 10-1 20 1 28 2 2 4 3 6 2 1-10 0-20-2-28-1-2-3-3-5-2zm84 0c2 10 1 20-1 28-2 2-4 3-6 2-1-10 0-20 2-28 1-2 3-3 5-2z",
  },
  core: {
    front:
      "M52 78h24c1 8 1 16 0 24-1 6-4 11-12 11s-11-5-12-11c-1-8-1-16 0-24z",
  },
  obliques: {
    front:
      "M44 80c-3 8-4 16-3 24 2 3 4 4 6 3 0-8 1-16 3-24-1-2-3-3-6-3zm40 0c3 8 4 16 3 24-2 3-4 4-6 3 0-8-1-16-3-24 1-2 3-3 6-3z",
  },
  quads: {
    front:
      "M42 118c-2 14-1 28 1 40 3 4 7 5 11 3 1-14 0-28-2-40-2-3-5-4-10-3zm46 0c2 14 1 28-1 40-3 4-7 5-11 3-1-14 0-28 2-40 2-3 5-4 10-3z",
  },
  calves: {
    front:
      "M44 168c-1 10 0 18 2 24 2 2 5 2 7 0 0-8-1-16-2-24-1-2-4-2-7 0zm40 0c1 10 0 18-2 24-2 2-5 2-7 0 0-8 1-16 2-24 1-2 4-2 7 0z",
  },
  glutes: {
    back:
      "M44 112c2-6 8-10 16-10s14 4 16 10c1 6-1 12-6 15-3 2-7 3-10 3s-7-1-10-3c-5-3-7-9-6-15z",
  },
  hamstrings: {
    back:
      "M42 132c-1 12 0 24 2 34 3 3 7 4 11 2 0-12-1-24-3-34-2-2-5-3-10-2zm46 0c1 12 0 24-2 34-3 3-7 4-11 2 0-12 1-24 3-34 2-2 5-3 10-2z",
  },
  traps: {
    back:
      "M48 42c4-8 10-12 16-12s12 4 16 12c2 5 1 10-2 13-4 3-9 4-14 4s-10-1-14-4c-3-3-4-8-2-13z",
  },
  lats: {
    back:
      "M34 58c-2 12 0 26 4 38 4 6 10 8 16 6 2-14 1-28-2-40-3-4-8-6-18-4zm70 0c2 12 0 26-4 38-4 6-10 8-16 6-2-14-1-28 2-40 3-4 8-6 18-4z",
  },
  upperBack: {
    back:
      "M46 54c3-5 9-8 18-8s15 3 18 8c2 6 1 12-2 16-4 4-10 5-16 5s-12-1-16-5c-3-4-4-10-2-16z",
  },
  lowerBack: {
    back:
      "M52 88h24c1 6 1 12 0 18-1 4-4 7-12 7s-11-3-12-7c-1-6-1-12 0-18z",
  },
};

const OUTLINE = "#4b5563";
const BASE_GREY = "#9ca3af";

function BodySilhouette() {
  return (
    <g strokeLinejoin="round">
      {/* Base body — cool grey */}
      <g fill={BASE_GREY} stroke={OUTLINE} strokeWidth="1.5">
        <ellipse cx="64" cy="22" rx="12" ry="14" />
        <path d="M56 34c1 6 3 8 8 8s7-2 8-8" />
        <path d="M40 48c6-6 14-9 24-9s18 3 24 9c4 5 6 12 6 20v28c0 8-3 14-8 18-4 3-10 5-22 5s-18-2-22-5c-5-4-8-10-8-18V68c0-8 2-15 6-20z" />
        <path d="M40 52c-8 2-14 8-16 16-2 10-1 22 1 34 1 6 4 10 8 11 2-12 2-24 1-36 0-8 2-14 6-20z" />
        <path d="M88 52c8 2 14 8 16 16 2 10 1 22-1 34-1 6-4 10-8 11-2-12-2-24-1-36 0-8-2-14-6-20z" />
        <path d="M25 110c-2 12-1 22 1 30 2 4 5 5 8 4 0-10-1-20-2-30-1-3-4-4-7-4z" />
        <path d="M103 110c2 12 1 22-1 30-2 4-5 5-8 4 0-10 1-20 2-30 1-3 4-4 7-4z" />
        <path d="M50 118c-3 0-6 2-7 6-2 14-1 30 1 44 1 6 4 10 8 11 2-16 1-32-1-46 0-5 1-9-1-15z" />
        <path d="M78 118c3 0 6 2 7 6 2 14 1 30-1 44-1 6-4 10-8 11-2-16-1-32 1-46 0-5-1-9 1-15z" />
        <path d="M44 176c0 4 2 8 8 9h6c1-4 0-8-1-10-3-1-8-1-13 1z" />
        <path d="M84 176c0 4-2 8-8 9h-6c-1-4 0-8 1-10 3-1 8-1 13 1z" />
      </g>
      {/* Definition lines */}
      <g fill="none" stroke="#6b7280" strokeWidth="1" strokeOpacity="0.55">
        <path d="M64 48v54" />
        <path d="M52 78h24" />
        <path d="M52 90h24" />
        <path d="M52 102h24" />
        <path d="M44 68c4 2 8 3 12 3s8-1 12-3" />
        <path d="M48 118v40" />
        <path d="M80 118v40" />
        <path d="M30 78c2 8 3 16 2 24" />
        <path d="M98 78c-2 8-3 16-2 24" />
      </g>
    </g>
  );
}

function HeatOverlay({
  view,
  heat,
}: {
  view: "front" | "back";
  heat: Partial<Record<MuscleRegion, MuscleHeatLevel>>;
}) {
  const regions = (Object.keys(REGION_PATHS) as MuscleRegion[]).filter((r) => {
    const path = view === "front" ? REGION_PATHS[r].front : REGION_PATHS[r].back;
    const level = heat[r];
    return Boolean(path && level && level !== "none");
  });

  return (
    <g>
      {regions.map((region) => {
        const path = view === "front" ? REGION_PATHS[region].front! : REGION_PATHS[region].back!;
        const level = heat[region] ?? "none";
        return (
          <path
            key={`${view}-${region}`}
            d={path}
            fill={muscleHeatFill(level)}
            fillOpacity={muscleHeatOpacity(level)}
            stroke={muscleHeatStroke(level)}
            strokeWidth="1.2"
            strokeOpacity={0.9}
          />
        );
      })}
    </g>
  );
}

function HeatChip({
  region,
  heat,
}: {
  region: MuscleRegion;
  heat: MuscleHeatLevel;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
      style={{
        borderColor: muscleHeatStroke(heat),
        background: `${muscleHeatFill(heat)}22`,
        color: muscleHeatStroke(heat),
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: muscleHeatFill(heat) }} />
      {MUSCLE_REGION_LABELS[region]}
    </span>
  );
}

export function MuscleMap({ breakdown, className = "", size = "md", showLegend = true }: Props) {
  const dim = size === "sm" ? 88 : 118;
  const heat = breakdown.heat;

  const labels = [
    ...breakdown.primary.map((r) => ({
      region: r,
      heat: (heat[r] ?? "high") as MuscleHeatLevel,
    })),
    ...breakdown.secondary.map((r) => ({
      region: r,
      heat: (heat[r] ?? "low") as MuscleHeatLevel,
    })),
  ];

  if (labels.length === 0 && breakdown.activityGroups.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex gap-1.5">
        {(["front", "back"] as const).map((view) => (
          <svg
            key={view}
            width={dim * 0.55}
            height={dim}
            viewBox="0 0 128 200"
            className="shrink-0"
            aria-hidden
          >
            <BodySilhouette />
            <HeatOverlay view={view} heat={heat} />
            <text
              x="64"
              y="196"
              textAnchor="middle"
              className="fill-[var(--muted)]"
              style={{ fontSize: 9 }}
            >
              {view === "front" ? "Front" : "Back"}
            </text>
          </svg>
        ))}
      </div>
      {showLegend && (
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Muscles worked
          </p>
          <div className="flex flex-wrap gap-1">
            {labels.map(({ region, heat: level }) => (
              <HeatChip key={region} region={region} heat={level} />
            ))}
            {breakdown.activityGroups.map((group) => (
              <span
                key={group}
                className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]"
              >
                {group}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-[var(--muted)]">
            Grey = resting · Pale yellow → dark red = more work
          </p>
        </div>
      )}
    </div>
  );
}

export function MuscleChips({
  breakdown,
  className = "",
}: {
  breakdown: WorkoutMuscleBreakdown;
  className?: string;
}) {
  const items = [
    ...breakdown.primary.map((r) => ({
      region: r,
      heat: (breakdown.heat[r] ?? "high") as MuscleHeatLevel,
    })),
    ...breakdown.secondary.map((r) => ({
      region: r,
      heat: (breakdown.heat[r] ?? "low") as MuscleHeatLevel,
    })),
  ];
  if (items.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {items.map(({ region, heat }) => (
        <HeatChip key={region} region={region} heat={heat} />
      ))}
    </div>
  );
}
