/**
 * Missed scheduled sessions must remain historical.
 * Run: npm run test:missed-sessions
 */
import assert from "node:assert/strict";
import {
    historicalAssignmentWindow,
    pickCalendarScheduledSession,
    priorResetAssignmentWindow,
} from "../src/lib/calendarScheduledSession";
import { computeWorkoutCompliance } from "../src/lib/calendarCompliance";
import { computePeriodTrainingStats } from "../src/lib/coachClientPeriodStats";
import { filterHistoricalMissedForActivePlan } from "../src/lib/planMissedSessionHistory";
import { hasGenuineMissedScheduledWorkout } from "../src/lib/coachMissedScheduledWorkouts";
import type { ActiveUserPlanLike } from "../src/lib/planSchedule";
import { parseLogDate } from "../src/lib/utils";

let passed = 0;
function check(name: string, fn: () => void) {
    try {
        fn();
        passed += 1;
        console.log(`  ✓ ${name}`);
    } catch (err) {
        console.error(`  ✗ ${name}`);
        throw err;
    }
}

const weeklyPlan: ActiveUserPlanLike = {
    startedAt: new Date("2026-09-01T12:00:00Z"),
    plan: {
        id: "plan-new",
        weeks: [{
            weekNumber: 1,
            workouts: [
                { id: "push", name: "Push", dayNumber: 1, dayOfWeek: 0, exercises: [{ id: "e1" }] },
                { id: "rest", name: "Rest", dayNumber: 2, dayOfWeek: 1, exercises: [] },
                { id: "pull", name: "Pull", dayNumber: 3, dayOfWeek: 2, exercises: [{ id: "e2" }] },
            ],
        }],
    },
};

console.log("\nMissed session history tests\n");

check("1. yesterday never started stays historical, not live", () => {
    const picked = pickCalendarScheduledSession({
        dateKey: "2026-09-04",
        todayKey: "2026-09-05",
        completed: null,
        historical: { id: "old-push", name: "Push" },
        live: { id: "new-rest", name: "Rest" },
    });
    assert.deepEqual(picked, { id: "old-push", name: "Push" });
});

check("2. plan edit does not replace a frozen missed day", () => {
    const picked = pickCalendarScheduledSession({
        dateKey: "2026-09-04",
        todayKey: "2026-09-05",
        completed: null,
        historical: { id: "legs", name: "Legs" },
        live: { id: "upper", name: "Upper" },
    });
    assert.equal(picked?.id, "legs");
});

check("3. new plan start does not hide an older missed session", () => {
    const picked = pickCalendarScheduledSession({
        dateKey: "2026-08-20",
        todayKey: "2026-09-05",
        completed: null,
        historical: { id: "old-plan-w", name: "Old Push" },
        live: null,
    });
    assert.equal(picked?.id, "old-plan-w");
    const kept = filterHistoricalMissedForActivePlan(
        [{ planId: "old-plan", dateKey: "2026-08-20", workoutId: "old-plan-w", workoutName: "Old Push" }],
        "plan-new",
        new Date("2026-09-05T12:00:00Z")
    );
    assert.equal(kept.length, 1);
});

check("4. new week/month still keeps previous missed sessions", () => {
    const window = historicalAssignmentWindow("2026-08-01", null, "2026-09-04");
    assert.deepEqual(window, { fromKey: "2026-08-01", toKey: "2026-09-04" });
});

check("5. calendar refresh prefers frozen history over recomputed live", () => {
    const picked = pickCalendarScheduledSession({
        dateKey: "2026-09-04",
        todayKey: "2026-09-05",
        completed: null,
        historical: { id: "frozen", name: "Frozen" },
        live: { id: "recomputed", name: "Recomputed" },
    });
    assert.equal(picked?.id, "frozen");
});

check("6. future regeneration never includes today or later", () => {
    assert.equal(historicalAssignmentWindow("2026-09-05", null, "2026-09-04"), null);
    const future = pickCalendarScheduledSession({
        dateKey: "2026-09-08",
        todayKey: "2026-09-05",
        completed: null,
        historical: { id: "should-not-use", name: "Old" },
        live: { id: "future", name: "Future Pull" },
    });
    assert.equal(future?.id, "future");
});

check("7. future session changes do not touch historical dates", () => {
    const window = historicalAssignmentWindow("2026-09-01", "2026-09-05", "2026-09-10");
    assert.deepEqual(window, { fromKey: "2026-09-01", toKey: "2026-09-04" });
});

check("8. excused stays a visible session, not deleted", () => {
    const month = computeWorkoutCompliance(
        {
            activePlan: { weeks: weeklyPlan.plan.weeks },
            planStartedAt: "2026-09-01T12:00:00.000Z",
            loggedDates: [],
            excusedMissedWorkoutKeys: ["2026-09-01:push"],
            historicalMissedSessions: [
                { dateKey: "2026-09-01", workoutId: "push", workoutName: "Push" },
            ],
        },
        parseLogDate("2026-09-01"),
        parseLogDate("2026-09-01"),
        { referenceToday: parseLogDate("2026-09-05") }
    );
    assert.equal(month.due, 0);
    assert.equal(month.completed, 0);
});

check("9. late complete updates status without a duplicate due slot", () => {
    const month = computeWorkoutCompliance(
        {
            activePlan: { weeks: weeklyPlan.plan.weeks },
            planStartedAt: "2026-09-01T12:00:00.000Z",
            loggedDates: [{ date: "2026-09-01", workoutId: "push" }],
            historicalMissedSessions: [
                { dateKey: "2026-09-01", workoutId: "push", workoutName: "Push" },
            ],
        },
        parseLogDate("2026-09-01"),
        parseLogDate("2026-09-01"),
        { referenceToday: parseLogDate("2026-09-05") }
    );
    assert.equal(month.completed, 1);
    assert.equal(month.due, 1);
});

check("monthly progress is 15/18 not 15/15", () => {
    const completed = Array.from({ length: 15 }, (_, index) => ({
        date: `2026-08-${String(index + 1).padStart(2, "0")}`,
        workoutId: `w${index + 1}`,
    }));
    const missed = [
        { dateKey: "2026-08-16", workoutId: "w16", workoutName: "Miss 1" },
        { dateKey: "2026-08-17", workoutId: "w17", workoutName: "Miss 2" },
        { dateKey: "2026-08-18", workoutId: "w18", workoutName: "Miss 3" },
    ];
    const result = computeWorkoutCompliance(
        {
            activePlan: { weeks: weeklyPlan.plan.weeks },
            planStartedAt: "2026-09-01T12:00:00.000Z",
            loggedDates: completed,
            historicalMissedSessions: [
                ...completed.map((log) => ({
                    dateKey: log.date,
                    workoutId: log.workoutId,
                    workoutName: "Done",
                })),
                ...missed,
            ],
        },
        parseLogDate("2026-08-01"),
        parseLogDate("2026-08-31"),
        { referenceToday: parseLogDate("2026-09-05") }
    );
    assert.equal(result.completed, 15);
    assert.equal(result.due, 18);
});

check("period stats count historical misses from a previous plan", () => {
    const stats = computePeriodTrainingStats({
        activeUserPlan: {
            ...weeklyPlan,
            startedAt: new Date("2026-09-05T12:00:00Z"),
        },
        completedLogs: Array.from({ length: 15 }, (_, index) => ({
            workoutId: `w${index + 1}`,
            dateKey: `2026-08-${String(index + 1).padStart(2, "0")}`,
        })),
        historicalMissedSessions: [
            { dateKey: "2026-08-16", workoutId: "w16" },
            { dateKey: "2026-08-17", workoutId: "w17" },
            { dateKey: "2026-08-18", workoutId: "w18" },
            ...Array.from({ length: 15 }, (_, index) => ({
                dateKey: `2026-08-${String(index + 1).padStart(2, "0")}`,
                workoutId: `w${index + 1}`,
            })),
        ],
        today: parseLogDate("2026-09-05"),
        startDateKey: "2026-08-01",
        endDateKey: "2026-08-31",
    });
    assert.equal(stats.completed, 15);
    assert.equal(stats.scheduled, 18);
    assert.equal(stats.missed, 3);
});

check("completed log wins over historical miss", () => {
    const picked = pickCalendarScheduledSession({
        dateKey: "2026-09-04",
        todayKey: "2026-09-05",
        completed: { id: "push", name: "Push done" },
        historical: { id: "push", name: "Push" },
        live: { id: "pull", name: "Pull" },
    });
    assert.equal(picked?.name, "Push done");
});

check("in-progress past session is not turned into missed", () => {
    const picked = pickCalendarScheduledSession({
        dateKey: "2026-09-04",
        todayKey: "2026-09-05",
        completed: null,
        inProgress: { id: "push", name: "Push" },
        historical: { id: "push", name: "Push" },
        live: null,
    });
    assert.equal(picked?.id, "push");
});

check("startedAt reset still recovers earlier assignment dates", () => {
    const prior = priorResetAssignmentWindow(
        "2026-08-01",
        "2026-09-05",
        ["2026-09-01"],
        "2026-09-04"
    );
    assert.deepEqual(prior, { fromKey: "2026-08-01", toKey: "2026-08-31" });
});

check("Needs Attention still sees a frozen miss after a new plan starts", () => {
    assert.equal(
        hasGenuineMissedScheduledWorkout({
            today: parseLogDate("2026-09-05"),
            todayKey: "2026-09-05",
            activeUserPlan: {
                ...weeklyPlan,
                startedAt: new Date("2026-09-05T12:00:00Z"),
            },
            completedLogKeys: new Set(),
            inProgressLogKeys: new Set(),
            excusedKeys: new Set(),
            pauseClient: { isCoachPaused: false, coachResumedAt: null },
            historicalMissedSessions: [
                { dateKey: "2026-09-04", workoutId: "old-push", workoutName: "Push" },
            ],
        }),
        true
    );
});

console.log(`\n${passed} missed-session checks passed\n`);
