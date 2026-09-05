import { shiftDateKey } from "@/lib/coachNotificationSchedule";
import {
    shouldSuppressCoachMissedAttention,
    type CoachPauseStatus,
} from "@/lib/coachClientPause";
import { getPlannedWorkoutForDate, type ActiveUserPlanLike } from "@/lib/planSchedule";
import { isScheduledTrainingWorkout } from "@/lib/planTrainingTarget";
import { parseLogDate } from "@/lib/utils";
import { resolveWorkoutDayStatus, type WorkoutDayStatus } from "@/lib/workoutDayStatus";

/** Same lookback as Needs Attention / inbox for "has a missed scheduled workout". */
export const COACH_MISSED_WORKOUT_LOOKBACK_DAYS = 7;

export type MissedWorkoutPauseClient = Pick<CoachPauseStatus, "isCoachPaused" | "coachResumedAt"> & {
    isCoachPaused?: boolean | null;
};

export interface ScheduledWorkoutLookbackSlot {
    dateKey: string;
    workoutId: string;
    workoutName: string;
    status: WorkoutDayStatus;
}

export function logSlotKey(dateKey: string, workoutId: string): string {
    return `${dateKey}:${workoutId}`;
}

export function listLookbackScheduledWorkoutSlots(input: {
    today: Date;
    todayKey: string;
    activeUserPlan: ActiveUserPlanLike | null | undefined;
    completedLogKeys: Set<string>;
    inProgressLogKeys: Set<string>;
    excusedKeys: Set<string>;
    pauseClient: MissedWorkoutPauseClient;
    lookbackDays?: number;
}): ScheduledWorkoutLookbackSlot[] {
    const lookbackDays = input.lookbackDays ?? COACH_MISSED_WORKOUT_LOOKBACK_DAYS;
    if (!input.activeUserPlan) return [];
    if (input.pauseClient.isCoachPaused) return [];

    const slots: ScheduledWorkoutLookbackSlot[] = [];

    for (let offset = 1; offset <= lookbackDays; offset++) {
        const dateKey = shiftDateKey(input.todayKey, -offset);
        if (shouldSuppressCoachMissedAttention(input.pauseClient, dateKey)) continue;

        const planned = getPlannedWorkoutForDate(input.activeUserPlan, parseLogDate(dateKey), {
            today: input.today,
            dateKey,
        });
        const hasScheduledTraining = Boolean(planned && isScheduledTrainingWorkout(planned));
        if (!planned || !hasScheduledTraining) continue;

        const slotKey = logSlotKey(dateKey, planned.id);
        const status = resolveWorkoutDayStatus({
            hasCompletedLog: input.completedLogKeys.has(slotKey),
            hasActiveSession: input.inProgressLogKeys.has(slotKey),
            hasScheduledTraining: true,
            isPast: true,
            isToday: false,
            isExcused: input.excusedKeys.has(slotKey),
        });

        slots.push({
            dateKey,
            workoutId: planned.id,
            workoutName: planned.name,
            status,
        });
    }

    return slots;
}

/** True when a client has a genuine missed scheduled workout in the lookback window. */
export function hasGenuineMissedScheduledWorkout(
    input: Parameters<typeof listLookbackScheduledWorkoutSlots>[0]
): boolean {
    return listLookbackScheduledWorkoutSlots(input).some((slot) => slot.status === "missed");
}
