/**
 * Coach client profile calculations (no DB).
 * Run: npm run test:coach-profile
 */
import assert from "node:assert/strict";
import { buildCoachClientAttentionItems } from "../src/lib/coachClientAttention";
import {
    computePeriodBodyweightStats,
    computePeriodCheckInStats,
    computePeriodTrainingStats,
    expectedDaysInWindow,
    periodWindow,
    previousPeriodWindow,
} from "../src/lib/coachClientPeriodStats";
import {
    isCaloriesOnTarget,
    isSleepOnTarget,
    isStepsOnTarget,
    percentDelta,
    resolveWeightDirection,
    summarizeLifestylePeriod,
} from "../src/lib/lifestylePeriodMetrics";
import type { CheckInDueState } from "../src/lib/checkInSchedule";
import type { ActiveUserPlanLike } from "../src/lib/planSchedule";
import { parseLogDate } from "../src/lib/utils";

let passed = 0;
function check(name: string, fn: () => void) {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (err) {
        console.error(`  ✗ ${name}`);
        throw err;
    }
}

const emptyDue: CheckInDueState = {
    day: 1,
    frequencyWeeks: 1,
    startDate: "2026-01-05",
    isConfigured: true,
    isDueWeek: false,
    isDueToday: false,
    isOverdue: false,
    daysUntilNext: 3,
    daysOverdue: null,
    nextDueDate: "2026-09-08",
    dueDayLabel: "Monday",
    currentPeriodDueDate: null,
    outstandingWeekNumber: null,
};

console.log("\nCoach client profile tests\n");

check("missing lifestyle days are not treated as zero", () => {
    const summary = summarizeLifestylePeriod(
        [
            { date: "2026-09-01", calories: 2200, steps: 8000, sleepHours: 7.5 },
            { date: "2026-09-02", calories: null, steps: null, sleepHours: null },
            { date: "2026-09-03", calories: 1800, steps: 10000, sleepHours: 8 },
        ],
        { targetCalories: 2000, targetSteps: 10000, targetSleepHours: 8 },
        3
    );
    assert.equal(summary.calories.loggedDays, 2);
    assert.equal(summary.calories.average, 2000);
    assert.equal(summary.steps.loggedDays, 2);
    assert.equal(summary.sleep.loggedDays, 2);
    assert.equal(summary.calories.expectedDays, 3);
});

check("logged zero calories/steps/sleep remain zero", () => {
    const summary = summarizeLifestylePeriod(
        [{ date: "2026-09-01", calories: 0, steps: 0, sleepHours: 0 }],
        { targetCalories: 2000, targetSteps: 10000, targetSleepHours: 8 },
        1
    );
    assert.equal(summary.calories.average, 0);
    assert.equal(summary.steps.average, 0);
    assert.equal(summary.sleep.average, 0);
    assert.equal(summary.calories.loggedDays, 1);
    assert.equal(summary.steps.adherencePercent, 0);
});

check("steps at or above target count as met", () => {
    assert.equal(isStepsOnTarget(10000, 10000), true);
    assert.equal(isStepsOnTarget(12000, 10000), true);
    assert.equal(isStepsOnTarget(9999, 10000), false);
});

check("sleep does not reward absurdly high values", () => {
    assert.equal(isSleepOnTarget(8, 8), true);
    assert.equal(isSleepOnTarget(9.5, 8), true);
    assert.equal(isSleepOnTarget(14, 8), false);
    assert.equal(isSleepOnTarget(5, 8), false);
});

check("calories use a tolerance band instead of higher/lower is better", () => {
    assert.equal(isCaloriesOnTarget(2500, 2500), true);
    assert.equal(isCaloriesOnTarget(2600, 2500), true);
    assert.equal(isCaloriesOnTarget(4000, 2500), false);
    assert.equal(isCaloriesOnTarget(1800, 2500), false);
    const summary = summarizeLifestylePeriod(
        [{ date: "2026-09-01", calories: 4000, steps: null, sleepHours: null }],
        { targetCalories: 2500, targetSteps: null, targetSleepHours: null },
        1
    );
    assert.equal(summary.calories.assessment, "Above target");
    assert.equal(summary.calories.adherencePercent, 0);
});

check("percentage change is omitted when previous is missing or zero", () => {
    assert.equal(percentDelta(10, null), null);
    assert.equal(percentDelta(10, 0), null);
    assert.equal(percentDelta(12, 10), 20);
});

check("weight direction uses target vs baseline, not a progress percent", () => {
    assert.equal(resolveWeightDirection(80, 75), "GAINING");
    assert.equal(resolveWeightDirection(70, 75), "LOSING");
    assert.equal(resolveWeightDirection(75.1, 75), "MAINTAINING");
    assert.equal(resolveWeightDirection(null, 75), null);
});

check("bodyweight change needs two logged points", () => {
    const none = computePeriodBodyweightStats([], "2026-09-01", "2026-09-07", null);
    assert.equal(none.currentKg, null);
    assert.equal(none.changeKg, null);
    const one = computePeriodBodyweightStats(
        [{ date: "2026-09-03", weightKg: 80 }],
        "2026-09-01",
        "2026-09-07",
        80
    );
    assert.equal(one.currentKg, 80);
    assert.equal(one.changeKg, null);
    const two = computePeriodBodyweightStats(
        [
            { date: "2026-09-01", weightKg: 82 },
            { date: "2026-09-07", weightKg: 80.2 },
        ],
        "2026-09-01",
        "2026-09-07",
        80.2
    );
    assert.equal(two.changeKg, -1.8);
});

check("equivalent period windows do not overlap", () => {
    const current = periodWindow("2026-09-05", 30);
    const previous = previousPeriodWindow(current.startDateKey, 30);
    assert.equal(current.startDateKey, "2026-08-07");
    assert.equal(previous.endDateKey, "2026-08-06");
    assert.equal(previous.startDateKey, "2026-07-08");
});

check("expected days start at account creation", () => {
    assert.equal(expectedDaysInWindow("2026-08-01", "2026-08-10", "2026-08-08"), 3);
});

check("training adherence ignores rest days and pending today", () => {
    const plan: ActiveUserPlanLike = {
        startedAt: new Date("2026-08-31T12:00:00Z"),
        plan: {
            weeks: [{
                weekNumber: 1,
                workouts: [
                    { id: "upper", name: "Upper", dayNumber: 1, dayOfWeek: 0, exercises: [{ id: "e1" }] },
                    { id: "rest", name: "Rest", dayNumber: 2, dayOfWeek: 1, exercises: [] },
                    { id: "lower", name: "Lower", dayNumber: 3, dayOfWeek: 2, exercises: [{ id: "e2" }] },
                ],
            }],
        },
    };
    const stats = computePeriodTrainingStats({
        activeUserPlan: plan,
        completedLogs: [{ workoutId: "upper", dateKey: "2026-08-31" }],
        today: parseLogDate("2026-09-02"),
        startDateKey: "2026-08-31",
        endDateKey: "2026-09-02",
    });
    assert.equal(stats.scheduled, 2);
    assert.equal(stats.completed, 1);
    assert.equal(stats.missed, 0);
    assert.equal(stats.adherencePercent, 50);
});

check("no plan means training adherence is missing, not 0", () => {
    const stats = computePeriodTrainingStats({
        activeUserPlan: null,
        completedLogs: [],
        today: parseLogDate("2026-09-05"),
        startDateKey: "2026-08-07",
        endDateKey: "2026-09-05",
    });
    assert.equal(stats.adherencePercent, null);
    assert.equal(stats.scheduled, 0);
});

check("check-in completion stays missing without a schedule", () => {
    const stats = computePeriodCheckInStats(["2026-09-01"], "2026-08-07", "2026-09-05", null);
    assert.equal(stats.expected, null);
    assert.equal(stats.completionPercent, null);
    assert.equal(stats.submitted, 1);
});

check("attention stays quiet without weak-data alerts", () => {
    const items = buildCoachClientAttentionItems({
        canEdit: true,
        clientId: "c1",
        isCoachPaused: false,
        hasActivePlan: true,
        planEnded: false,
        checkInDueState: emptyDue,
        latestCheckIn: { id: "ci1", needsReview: false },
        missedWorkouts: [],
        trainingAdherencePercent: 40,
        trainingScheduled: 2,
        steps: {
            key: "steps",
            average: 4000,
            target: 10000,
            adherencePercent: 20,
            loggedDays: 5,
            expectedDays: 30,
            loggingRatePercent: 17,
            onTargetDays: 1,
            assessment: "Behind target",
        },
    });
    assert.equal(items.length, 0);
});

check("paused clients do not get missed-workout or overdue alerts", () => {
    const items = buildCoachClientAttentionItems({
        canEdit: true,
        clientId: "c1",
        isCoachPaused: true,
        hasActivePlan: true,
        planEnded: false,
        checkInDueState: {
            ...emptyDue,
            isOverdue: true,
            daysOverdue: 3,
            currentPeriodDueDate: "2026-09-01",
        },
        latestCheckIn: null,
        missedWorkouts: [{
            dateKey: "2026-09-02",
            dateLabel: "Tuesday",
            workoutId: "w1",
            workoutName: "Upper",
        }],
        trainingAdherencePercent: 20,
        trainingScheduled: 8,
        steps: {
            key: "steps",
            average: null,
            target: null,
            adherencePercent: null,
            loggedDays: 0,
            expectedDays: 30,
            loggingRatePercent: 0,
            onTargetDays: null,
            assessment: null,
        },
    });
    assert.equal(items.some((item) => item.kind === "missed_workout"), false);
    assert.equal(items.some((item) => item.kind === "checkin_overdue"), false);
    assert.equal(items.some((item) => item.kind === "low_training"), false);
});

check("genuine issues still surface: no plan and pending review", () => {
    const items = buildCoachClientAttentionItems({
        canEdit: true,
        clientId: "c1",
        isCoachPaused: false,
        hasActivePlan: false,
        planEnded: false,
        checkInDueState: { ...emptyDue, isConfigured: false, day: null, frequencyWeeks: null },
        latestCheckIn: { id: "ci1", needsReview: true },
        missedWorkouts: [],
        trainingAdherencePercent: null,
        trainingScheduled: 0,
        steps: {
            key: "steps",
            average: null,
            target: null,
            adherencePercent: null,
            loggedDays: 0,
            expectedDays: 7,
            loggingRatePercent: 0,
            onTargetDays: null,
            assessment: null,
        },
    });
    assert.ok(items.some((item) => item.kind === "no_plan"));
    assert.ok(items.some((item) => item.kind === "checkin_review" && item.actionLabel === "Review Check-in"));
    assert.ok(items.some((item) => item.kind === "setup_checkin" && item.href === "#check-in-schedule"));
});

console.log(`\n${passed} passed\n`);
