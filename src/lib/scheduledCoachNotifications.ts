/**
 * Identity + queue rules for scheduled coach missed alerts.
 * Producers live in coachMissedAlerts; persistence is pending_coach_notifications.
 */

export const COACH_MISSED_CHECKIN_TYPE = "CLIENT_MISSED_CHECKIN";
export const COACH_MISSED_WORKOUT_TYPE = "CLIENT_MISSED_WORKOUT";

export function coachMissedCheckInEntityId(
    clientId: string,
    weekNumber: number,
    isoWeekYear: number
): string {
    return `${clientId}:${isoWeekYear}-W${weekNumber}`;
}

export function coachMissedWorkoutEntityId(
    clientId: string,
    dateKey: string,
    workoutId: string
): string {
    return `${clientId}:${dateKey}:${workoutId}`;
}

export function shouldQueueCoachMissedNotification(input: {
    conditionActive: boolean;
    alreadyQueuedOrSent: boolean;
    dismissedOrResolved: boolean;
    clientInactive: boolean;
    clientPaused: boolean;
}): boolean {
    if (!input.conditionActive) return false;
    if (input.dismissedOrResolved) return false;
    if (input.clientInactive || input.clientPaused) return false;
    if (input.alreadyQueuedOrSent) return false;
    return true;
}
