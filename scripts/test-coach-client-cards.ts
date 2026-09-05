/**
 * Coach dashboard My Clients card: check-in date copy + week-to-date workouts.
 * Run: npm run test:coach-client-cards
 */
import assert from "node:assert/strict";
import { computeWeeklyCompliance } from "../src/lib/calendarCompliance";
import { buildClientCardCheckInLabel } from "../src/lib/coachDashboardInsights";
import type { CheckInDueState } from "../src/lib/checkInSchedule";
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

const weekPlan = {
    weeks: [{
        weekNumber: 1,
        workouts: [
            { id: "mon", name: "Push", dayNumber: 1, dayOfWeek: 0, exercises: [{ id: "e1" }] },
            { id: "tue", name: "Pull", dayNumber: 2, dayOfWeek: 1, exercises: [{ id: "e2" }] },
            { id: "wed", name: "Legs", dayNumber: 3, dayOfWeek: 2, exercises: [{ id: "e3" }] },
            { id: "thu", name: "Upper", dayNumber: 4, dayOfWeek: 3, exercises: [{ id: "e4" }] },
            { id: "fri", name: "Full", dayNumber: 5, dayOfWeek: 4, exercises: [{ id: "e5" }] },
        ],
    }],
};

const wednesday = parseLogDate("2026-09-02");

function weekly(
    loggedDates: Array<{ date: string; workoutId?: string }>,
    extras?: {
        excusedMissedWorkoutKeys?: string[];
        historicalMissedSessions?: Array<{ dateKey: string; workoutId: string; workoutName: string }>;
        today?: Date;
        planStartedAt?: string;
        activePlan?: typeof weekPlan | null;
    }
) {
    return computeWeeklyCompliance(
        {
            activePlan: extras?.activePlan === null ? null : (extras?.activePlan ?? weekPlan),
            planStartedAt: extras?.planStartedAt ?? "2026-08-31T12:00:00.000Z",
            loggedDates,
            excusedMissedWorkoutKeys: extras?.excusedMissedWorkoutKeys,
            historicalMissedSessions: extras?.historicalMissedSessions,
        },
        extras?.today ?? wednesday
    );
}

function dueState(overrides: Partial<CheckInDueState> = {}): CheckInDueState {
    return {
        day: 6,
        frequencyWeeks: 1,
        startDate: "2026-01-01",
        isConfigured: true,
        isDueWeek: false,
        isDueToday: false,
        isOverdue: false,
        daysUntilNext: 2,
        daysOverdue: null,
        nextDueDate: "2026-09-12T12:00:00.000Z",
        dueDayLabel: "Saturday",
        currentPeriodDueDate: "2026-09-05T12:00:00.000Z",
        outstandingWeekNumber: 36,
        ...overrides,
    };
}

console.log("\nCoach client card tests\n");

check("check-in due today is the date only", () => {
    const result = buildClientCardCheckInLabel(
        dueState({ isDueToday: true, isDueWeek: true }),
        false
    );
    assert.equal(result.label, "5th September");
    assert.equal(result.label.includes("Due"), false);
});

check("check-in overdue is the date only", () => {
    const result = buildClientCardCheckInLabel(
        dueState({ isOverdue: true, daysOverdue: 3 }),
        false
    );
    assert.equal(result.label, "5th September");
    assert.equal(/overdue|due today|tomorrow/i.test(result.label), false);
});

check("submitted period shows the next date only", () => {
    const result = buildClientCardCheckInLabel(dueState({ isDueToday: false }), true);
    assert.equal(result.label, "12th September");
    assert.equal(result.label.includes("Next"), false);
});

check("no schedule is a clean empty state", () => {
    const result = buildClientCardCheckInLabel(
        dueState({
            isConfigured: false,
            currentPeriodDueDate: null,
            nextDueDate: null,
        }),
        false
    );
    assert.equal(result.status, "not_configured");
    assert.equal(result.label, "No schedule");
});

check("no workouts due yet this week is empty", () => {
    const fridayOnly = {
        weeks: [{
            weekNumber: 1,
            workouts: [
                { id: "fri", name: "Full", dayNumber: 5, dayOfWeek: 4, exercises: [{ id: "e5" }] },
            ],
        }],
    };
    const result = weekly([], { activePlan: fridayOnly });
    assert.equal(result.due, 0);
    assert.equal(result.completed, 0);
    assert.equal(result.percent, null);
});

check("1/1 completed", () => {
    const mondayOnly = {
        weeks: [{
            weekNumber: 1,
            workouts: [
                { id: "mon", name: "Push", dayNumber: 1, dayOfWeek: 0, exercises: [{ id: "e1" }] },
            ],
        }],
    };
    const result = weekly(
        [{ date: "2026-08-31", workoutId: "mon" }],
        { activePlan: mondayOnly }
    );
    assert.deepEqual(
        { completed: result.completed, due: result.due, percent: result.percent },
        { completed: 1, due: 1, percent: 100 }
    );
});

check("1/2 completed", () => {
    const twoDays = {
        weeks: [{
            weekNumber: 1,
            workouts: [
                { id: "mon", name: "Push", dayNumber: 1, dayOfWeek: 0, exercises: [{ id: "e1" }] },
                { id: "tue", name: "Pull", dayNumber: 2, dayOfWeek: 1, exercises: [{ id: "e2" }] },
            ],
        }],
    };
    const result = weekly(
        [{ date: "2026-08-31", workoutId: "mon" }],
        { activePlan: twoDays }
    );
    assert.deepEqual(
        { completed: result.completed, due: result.due, percent: result.percent },
        { completed: 1, due: 2, percent: 50 }
    );
});

check("Wed example is 2/3 · 67% and ignores Thu/Fri", () => {
    const result = weekly([
        { date: "2026-08-31", workoutId: "mon" },
        { date: "2026-09-01", workoutId: "tue" },
    ]);
    assert.equal(result.completed, 2);
    assert.equal(result.due, 3);
    assert.equal(result.percent, 67);
});

check("missed workout stays in the denominator", () => {
    const result = weekly([
        { date: "2026-08-31", workoutId: "mon" },
    ]);
    assert.equal(result.completed, 1);
    assert.equal(result.due, 3);
    assert.equal(result.percent, 33);
});

check("future workouts later in the week are excluded", () => {
    const result = weekly([
        { date: "2026-08-31", workoutId: "mon" },
        { date: "2026-09-01", workoutId: "tue" },
        { date: "2026-09-02", workoutId: "wed" },
    ]);
    assert.equal(result.due, 3);
    assert.equal(result.completed, 3);
    assert.equal(result.percent, 100);
});

check("excused session is excluded from both counts", () => {
    const result = weekly(
        [
            { date: "2026-08-31", workoutId: "mon" },
            { date: "2026-09-01", workoutId: "tue" },
        ],
        { excusedMissedWorkoutKeys: ["2026-09-02:wed"] }
    );
    assert.equal(result.completed, 2);
    assert.equal(result.due, 2);
    assert.equal(result.percent, 100);
});

check("plan change midweek keeps the already-due session", () => {
    const newPlan = {
        weeks: [{
            weekNumber: 1,
            workouts: [
                { id: "new-wed", name: "Conditioning", dayNumber: 3, dayOfWeek: 2, exercises: [{ id: "e9" }] },
                { id: "new-thu", name: "Upper", dayNumber: 4, dayOfWeek: 3, exercises: [{ id: "e4" }] },
            ],
        }],
    };
    const result = weekly(
        [{ date: "2026-08-31", workoutId: "old-mon" }],
        {
            activePlan: newPlan,
            planStartedAt: "2026-09-02T12:00:00.000Z",
            historicalMissedSessions: [
                { dateKey: "2026-08-31", workoutId: "old-mon", workoutName: "Old Push" },
                { dateKey: "2026-09-01", workoutId: "old-tue", workoutName: "Old Pull" },
            ],
        }
    );
    assert.equal(result.completed, 1);
    assert.equal(result.due, 3);
    assert.equal(result.percent, 33);
});

check("completed after previously being missed counts as done", () => {
    const result = weekly(
        [{ date: "2026-08-31", workoutId: "mon" }],
        {
            historicalMissedSessions: [
                { dateKey: "2026-08-31", workoutId: "mon", workoutName: "Push" },
            ],
        }
    );
    assert.equal(result.completed, 1);
    assert.equal(result.due, 3);
});

check("logs without workoutId do not fake 0% when the slot was completed", () => {
    const broken = weekly([{ date: "2026-08-31" }, { date: "2026-09-01" }]);
    const fixed = weekly([
        { date: "2026-08-31", workoutId: "mon" },
        { date: "2026-09-01", workoutId: "tue" },
    ]);
    assert.equal(broken.completed, 0);
    assert.equal(fixed.completed, 2);
    assert.equal(fixed.percent, 67);
});

check("Europe/Dublin week boundary starts on Monday", () => {
    const sunday = weekly(
        [
            { date: "2026-08-31", workoutId: "mon" },
            { date: "2026-09-01", workoutId: "tue" },
            { date: "2026-09-02", workoutId: "wed" },
            { date: "2026-09-03", workoutId: "thu" },
            { date: "2026-09-04", workoutId: "fri" },
        ],
        { today: parseLogDate("2026-09-06") }
    );
    assert.equal(sunday.due, 5);
    assert.equal(sunday.completed, 5);

    const nextMonday = weekly(
        [
            { date: "2026-08-31", workoutId: "mon" },
            { date: "2026-09-01", workoutId: "tue" },
        ],
        { today: parseLogDate("2026-09-07") }
    );
    assert.equal(nextMonday.due, 1);
    assert.equal(nextMonday.completed, 0);
    assert.equal(nextMonday.percent, 0);
});

console.log(`\n${passed} coach client card checks passed.`);
