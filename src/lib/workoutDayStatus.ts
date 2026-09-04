/**
 * The one definition of a training day's status.
 *
 * Calendar, Dashboard, Plans, streaks and coach views all derive status here so
 * they can never disagree. Precedence (load-bearing):
 *
 *   completed > in-progress > excused > missed > today > upcoming > rest
 *
 * Rest is only for days with no required scheduled training. A past scheduled
 * workout with no completion and no excuse is always Missed — never Rest.
 */

export type WorkoutDayStatus =
    | "completed"
    | "today"
    | "upcoming"
    | "in-progress"
    | "missed"
    | "excused"
    | "rest";

export interface WorkoutDayStatusInput {
    /** A completed log exists for this day. */
    hasCompletedLog: boolean;
    /** An in-progress session is attached to this day. */
    hasActiveSession: boolean;
    /**
     * A required training workout was/is scheduled for this day.
     * Historical missed sessions and named training workouts count even when
     * exercise lists are empty (reconstructions often omit sets).
     */
    hasScheduledTraining: boolean;
    isPast: boolean;
    isToday: boolean;
    /** A coach has excused the missed session on this day. */
    isExcused: boolean;
}

export function resolveWorkoutDayStatus(input: WorkoutDayStatusInput): WorkoutDayStatus {
    if (input.hasCompletedLog) return "completed";
    if (input.hasActiveSession) return "in-progress";

    // No required training on this day → Rest (never Missed).
    if (!input.hasScheduledTraining) return "rest";

    if (input.isPast && input.isExcused) return "excused";
    if (input.isPast) return "missed";
    if (input.isToday) return "today";
    return "upcoming";
}

/** Statuses that mean the user still has something to do on this day. */
export function isActionableStatus(status: WorkoutDayStatus): boolean {
    return status === "today" || status === "in-progress" || status === "missed";
}

export interface WorkoutDayStatusStyle {
    label: string;
    shortLabel: string;
    dot: string;
    barBg: string;
    barFill: string;
    text: string;
    badge: string;
    panelBg: string;
    panelBorder: string;
    panelLabel: string;
}

export const WORKOUT_DAY_STATUS_STYLES: Record<WorkoutDayStatus, WorkoutDayStatusStyle> = {
    completed: {
        label: "Completed",
        shortLabel: "Done",
        dot: "bg-success shadow-glow-success",
        barBg: "bg-success/20",
        barFill: "bg-success",
        text: "text-success",
        badge: "bg-success/15 text-success border-success/25",
        panelBg: "bg-success-950/20",
        panelBorder: "border-success-500/20 shadow-glow-success-sm",
        panelLabel: "text-success",
    },
    today: {
        label: "Today",
        shortLabel: "Today",
        dot: "bg-brand-400 shadow-glow-brand animate-pulse",
        barBg: "bg-brand-400/20",
        barFill: "bg-brand-400 animate-pulse",
        text: "text-brand-400",
        badge: "bg-brand-400/15 text-brand-400 border-brand-400/30",
        panelBg: "bg-brand-950/25",
        panelBorder: "border-brand-500/25 shadow-glow-brand-sm",
        panelLabel: "text-brand-400",
    },
    upcoming: {
        label: "Upcoming",
        shortLabel: "Soon",
        dot: "bg-brand-400/70",
        barBg: "bg-brand-400/15",
        barFill: "bg-brand-400/80",
        text: "text-brand-400/90",
        badge: "bg-brand-400/10 text-brand-400/90 border-brand-400/20",
        panelBg: "bg-brand-950/15",
        panelBorder: "border-brand-500/15",
        panelLabel: "text-brand-400",
    },
    "in-progress": {
        label: "In Progress",
        shortLabel: "Active",
        dot: "bg-warning shadow-glow-warning animate-pulse",
        barBg: "bg-warning/20",
        barFill: "bg-warning animate-pulse",
        text: "text-warning",
        badge: "bg-warning/15 text-warning border-warning/25",
        panelBg: "bg-warning-950/20",
        panelBorder: "border-warning-500/20 shadow-glow-warning-sm",
        panelLabel: "text-warning",
    },
    missed: {
        label: "Missed",
        shortLabel: "Missed",
        dot: "bg-danger shadow-glow-danger",
        barBg: "bg-danger/20",
        barFill: "bg-danger",
        text: "text-danger",
        badge: "bg-danger/15 text-danger border-danger/25",
        panelBg: "bg-danger-950/20",
        panelBorder: "border-danger-500/20",
        panelLabel: "text-danger",
    },
    excused: {
        label: "Excused",
        shortLabel: "Excused",
        dot: "bg-emerald-700 shadow-[0_0_8px_rgba(4,120,87,0.45)]",
        barBg: "bg-emerald-900/30",
        barFill: "bg-emerald-700",
        text: "text-emerald-700",
        badge: "bg-emerald-900/25 text-emerald-700 border-emerald-700/30",
        panelBg: "bg-emerald-950/35",
        panelBorder: "border-emerald-700/35 shadow-[0_0_12px_rgba(4,120,87,0.12)]",
        panelLabel: "text-emerald-700",
    },
    rest: {
        label: "Rest day",
        shortLabel: "Rest",
        dot: "bg-surface-border",
        barBg: "bg-surface-border/30",
        barFill: "bg-surface-border/50",
        text: "text-fg-subtle",
        badge: "bg-surface-muted/40 text-fg-subtle border-surface-border/50",
        panelBg: "bg-surface-muted/10",
        panelBorder: "border-surface-border/40",
        panelLabel: "text-fg-subtle",
    },
};

export function workoutDayStatusLabel(status: WorkoutDayStatus): string {
    return WORKOUT_DAY_STATUS_STYLES[status].label;
}
