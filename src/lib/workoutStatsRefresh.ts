/** Broadcast when workout logs change so Progress (and similar) refetch stats. */
export const WORKOUT_STATS_REFRESH_EVENT = "pt:workout-stats-changed";

export function notifyWorkoutStatsChanged() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(WORKOUT_STATS_REFRESH_EVENT));
}
