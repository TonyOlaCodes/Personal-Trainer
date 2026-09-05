import { formatCheckInDueDate } from "@/lib/checkInLabels";
import type { CheckInDueState } from "@/lib/checkInSchedule";
import { shouldSuppressCoachMissedAttention } from "@/lib/coachClientPause";
import type { LifestyleMetricSummary } from "@/lib/lifestylePeriodMetrics";

export type CoachAttentionKind =
    | "checkin_overdue"
    | "checkin_due"
    | "checkin_review"
    | "missed_workout"
    | "no_plan"
    | "plan_ended"
    | "low_training"
    | "low_steps"
    | "setup_checkin";

export interface CoachAttentionItem {
    id: string;
    kind: CoachAttentionKind;
    title: string;
    detail: string;
    href?: string;
    actionLabel?: string;
    action?: "request_checkin" | "review_checkin" | "assign_plan" | "open_href";
    urgent?: boolean;
}

interface MissedWorkoutCandidate {
    dateKey: string;
    dateLabel: string;
    workoutId: string;
    workoutName: string;
}

export function buildCoachClientAttentionItems(input: {
    canEdit: boolean;
    clientId: string;
    isCoachPaused: boolean;
    coachResumedAt?: Date | string | null;
    hasActivePlan: boolean;
    planEnded: boolean;
    checkInDueState: CheckInDueState;
    latestCheckIn: { id: string; needsReview: boolean } | null;
    missedWorkouts: MissedWorkoutCandidate[];
    trainingAdherencePercent: number | null;
    trainingScheduled: number;
    steps: LifestyleMetricSummary;
}): CoachAttentionItem[] {
    const items: CoachAttentionItem[] = [];
    const paused = shouldSuppressCoachMissedAttention({
        isCoachPaused: input.isCoachPaused,
        coachResumedAt: input.coachResumedAt,
    });

    if (!input.hasActivePlan) {
        items.push({
            id: "no-plan",
            kind: "no_plan",
            title: "No active plan",
            detail: "Assign a programme so this client has scheduled training.",
            href: `/plans/create?clientId=${input.clientId}`,
            actionLabel: "Assign Plan",
            action: "assign_plan",
            urgent: true,
        });
    } else if (input.planEnded) {
        items.push({
            id: "plan-ended",
            kind: "plan_ended",
            title: "Training plan ended",
            detail: "This programme has finished. Assign the next block when you are ready.",
            href: `/plans/create?clientId=${input.clientId}`,
            actionLabel: "Assign Plan",
            action: "assign_plan",
            urgent: true,
        });
    }

    if (!input.checkInDueState.isConfigured) {
        items.push({
            id: "setup-checkin",
            kind: "setup_checkin",
            title: "Check\u2011in schedule not set",
            detail: "Set a check-in day and frequency so progress reviews stay on track.",
            actionLabel: "Set schedule",
            action: "open_href",
            href: "#goals-schedule",
        });
    } else if (!paused && (input.checkInDueState.isOverdue || input.checkInDueState.isDueToday)) {
        const dueLabel = formatCheckInDueDate(input.checkInDueState.currentPeriodDueDate)
            ?? input.checkInDueState.dueDayLabel
            ?? "this period";
        items.push({
            id: "checkin-due",
            kind: input.checkInDueState.isOverdue ? "checkin_overdue" : "checkin_due",
            title: input.checkInDueState.isOverdue ? "Check\u2011in overdue" : "Check\u2011in due today",
            detail: input.checkInDueState.isOverdue
                ? (input.checkInDueState.daysOverdue != null && input.checkInDueState.daysOverdue > 1
                    ? `Due ${dueLabel} · ${input.checkInDueState.daysOverdue} days late`
                    : `Due ${dueLabel}`)
                : `Due ${dueLabel}`,
            actionLabel: "Request Check-in",
            action: "request_checkin",
            urgent: input.checkInDueState.isOverdue,
        });
    }

    if (input.latestCheckIn?.needsReview) {
        items.push({
            id: `checkin-review-${input.latestCheckIn.id}`,
            kind: "checkin_review",
            title: "Check\u2011in waiting for review",
            detail: "The latest check-in has not been reviewed yet.",
            href: `/checkins?highlight=${input.latestCheckIn.id}`,
            actionLabel: "Review Check-in",
            action: "review_checkin",
        });
    }

    if (!paused && input.hasActivePlan && !input.planEnded) {
        for (const missed of input.missedWorkouts.slice(0, 2)) {
            if (shouldSuppressCoachMissedAttention({
                isCoachPaused: input.isCoachPaused,
                coachResumedAt: input.coachResumedAt,
            }, missed.dateKey)) {
                continue;
            }
            items.push({
                id: `missed-${missed.dateKey}-${missed.workoutId}`,
                kind: "missed_workout",
                title: `${missed.workoutName} missed`,
                detail: missed.dateLabel,
                href: `/coach/calendar?clientId=${input.clientId}`,
                actionLabel: "Review",
                action: "open_href",
            });
        }
    }

    if (
        !paused
        && input.hasActivePlan
        && !input.planEnded
        && input.trainingScheduled >= 4
        && input.trainingAdherencePercent != null
        && input.trainingAdherencePercent < 55
    ) {
        items.push({
            id: "low-training",
            kind: "low_training",
            title: "Training adherence is low",
            detail: `${input.trainingAdherencePercent}% of scheduled sessions completed this period.`,
            href: `/coach/calendar?clientId=${input.clientId}`,
            actionLabel: "Review",
            action: "open_href",
        });
    }

    if (
        input.steps.target != null
        && input.steps.loggedDays >= 14
        && input.steps.adherencePercent != null
        && input.steps.adherencePercent < 65
    ) {
        items.push({
            id: "low-steps",
            kind: "low_steps",
            title: "Step adherence is low",
            detail: `${input.steps.adherencePercent}% of logged days hit the step target.`,
        });
    }

    return items;
}
