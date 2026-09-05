/**
 * Unit checks for check-in due / overdue / dismiss / recurrence.
 * Run: npx tsx scripts/test-checkin-due-state.ts
 */
import assert from "node:assert/strict";
import {
    getCheckInDueState,
    getFirstEligibleDueDate,
    getNextScheduledDueDateAfter,
    hasCheckInForOutstandingPeriod,
    toCheckInCalendarDate,
    type CheckInSchedule,
} from "../src/lib/checkInSchedule";
import {
    applyCheckInAttentionOverrides,
    buildCheckInAlertKey,
    buildLegacyCheckInAlertKey,
    clearOutstandingCheckInPeriod,
    findCheckInDismissAction,
} from "../src/lib/coachAttentionActions";
import { isCoachClientCheckInAttentionNeeded } from "../src/lib/coachOverdueCheckIns";
import { getWeekNumber } from "../src/lib/utils";

function d(iso: string) {
    return toCheckInCalendarDate(iso);
}

function schedule(day: number, frequencyWeeks: number, startDate: string): CheckInSchedule {
    return { day, frequencyWeeks, startDate };
}

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

console.log("\nCheck-in due state tests\n");

// Saturday weekly, start far enough in the past that first eligible is before tests
const weeklySat = schedule(6, 1, "2026-01-01T12:00:00.000Z");
// First eligible: start + 7 days → weekday Saturday on/after that
const first = getFirstEligibleDueDate(d("2026-01-01"), 6);

check("first eligible is a Saturday on/after start+7d", () => {
    assert.equal(first.getDay(), 6);
    assert.ok(first.getTime() >= d("2026-01-08").getTime());
});

check("Due tomorrow with no prior miss → upcoming (before first eligible)", () => {
    // Start so first eligible is tomorrow
    const tomorrow = d("2026-06-13"); // Saturday
    assert.equal(tomorrow.getDay(), 6);
    const start = d("2026-06-01"); // well before, but use a schedule whose first due is tomorrow
    // first eligible = weekday on/after start+7. Use start = tomorrow - 7 days exactly on same weekday path:
    const startDate = d(tomorrow.toISOString());
    startDate.setDate(startDate.getDate() - 7);
    // getFirstEligibleDueDate adds 7 days then finds Saturday — that becomes tomorrow
    const sched = schedule(6, 1, startDate.toISOString());
    const today = d(tomorrow.toISOString());
    today.setDate(today.getDate() - 1); // Friday
    const state = getCheckInDueState(sched, today);
    assert.equal(state.isOverdue, false);
    assert.equal(state.isDueToday, false);
    assert.equal(state.daysUntilNext, 1);
});

check("After prior period submitted conceptually: clearOutstanding leaves next due tomorrow", () => {
    const sat = getNextScheduledDueDateAfter(first, 1, d("2026-06-01"));
    const fri = d(sat.toISOString());
    fri.setDate(fri.getDate() + 6); // Friday after that Saturday (= day before next Sat)
    const raw = getCheckInDueState(weeklySat, fri);
    assert.equal(raw.isOverdue, true); // unpaid prior period
    const cleared = clearOutstandingCheckInPeriod(raw, fri);
    assert.equal(cleared.isOverdue, false);
    assert.equal(cleared.daysUntilNext, 1);
});

check("Due today, not submitted → Due Today", () => {
    const sat = getNextScheduledDueDateAfter(first, 1, d("2026-06-01"));
    const state = getCheckInDueState(weeklySat, sat);
    assert.equal(state.isDueToday, true);
    assert.equal(state.isOverdue, false);
    assert.equal(state.isDueWeek, true);
    assert.equal(state.daysOverdue, null);
    assert.equal(state.outstandingWeekNumber, getWeekNumber(sat));
});

check("Due yesterday, not submitted → Overdue 1 day (spans into next week)", () => {
    const sat = getNextScheduledDueDateAfter(first, 1, d("2026-06-01"));
    const sun = d(sat.toISOString());
    sun.setDate(sun.getDate() + 1);
    const state = getCheckInDueState(weeklySat, sun);
    assert.equal(state.isOverdue, true);
    assert.equal(state.isDueToday, false);
    assert.equal(state.daysOverdue, 1);
    assert.equal(toCheckInCalendarDate(state.currentPeriodDueDate!).getTime(), sat.getTime());
});

check("Multiple days overdue across week boundary (Monday after Saturday)", () => {
    const sat = getNextScheduledDueDateAfter(first, 1, d("2026-06-01"));
    const mon = d(sat.toISOString());
    mon.setDate(mon.getDate() + 2); // Sat → Mon
    const state = getCheckInDueState(weeklySat, mon);
    assert.equal(state.isOverdue, true);
    assert.equal(state.daysOverdue, 2);
    assert.equal(toCheckInCalendarDate(state.currentPeriodDueDate!).getTime(), sat.getTime());
    // Next scheduled remains the following Saturday (no drift)
    const nextSat = d(sat.toISOString());
    nextSat.setDate(nextSat.getDate() + 7);
    assert.equal(toCheckInCalendarDate(state.nextDueDate!).getTime(), nextSat.getTime());
});

check("Coach attention gate: overdue without submission", () => {
    const sat = getNextScheduledDueDateAfter(first, 1, d("2026-06-01"));
    const mon = d(sat.toISOString());
    mon.setDate(mon.getDate() + 2);
    const state = getCheckInDueState(weeklySat, mon);
    assert.equal(isCoachClientCheckInAttentionNeeded(state, false), true);
    assert.equal(isCoachClientCheckInAttentionNeeded(state, true), false);
});

check("Client submits overdue check-in for outstanding week → no longer needs attention", () => {
    const sat = getNextScheduledDueDateAfter(first, 1, d("2026-06-01"));
    const mon = d(sat.toISOString());
    mon.setDate(mon.getDate() + 2);
    const state = getCheckInDueState(weeklySat, mon);
    const week = state.outstandingWeekNumber!;
    assert.equal(hasCheckInForOutstandingPeriod(state, [week]), true);
    assert.equal(isCoachClientCheckInAttentionNeeded(state, true), false);
});

check("Dismiss overdue → cleared flags + next Saturday preserved", () => {
    const sat = getNextScheduledDueDateAfter(first, 1, d("2026-06-01"));
    const mon = d(sat.toISOString());
    mon.setDate(mon.getDate() + 2);
    const state = getCheckInDueState(weeklySat, mon);
    const week = state.outstandingWeekNumber!;
    const nextSat = d(sat.toISOString());
    nextSat.setDate(nextSat.getDate() + 7);

    const cleared = applyCheckInAttentionOverrides(
        state,
        [{
            alertKey: `check-in:client-1:${week}`,
            action: "dismissed",
            clientId: "client-1",
            category: "check_in_overdue",
            weekNumber: week,
            dateKey: null,
            workoutId: null,
            createdAt: new Date(),
        }],
        "client-1",
        week,
        mon,
        new Date() // active recently
    );

    assert.equal(cleared.isOverdue, false);
    assert.equal(cleared.isDueToday, false);
    assert.equal(cleared.daysOverdue, null);
    assert.equal(cleared.currentPeriodDueDate, null);
    assert.equal(toCheckInCalendarDate(cleared.nextDueDate!).getTime(), nextSat.getTime());
    assert.equal(isCoachClientCheckInAttentionNeeded(cleared, false), false);
});

check("Biweekly: miss due week, still overdue on off-week", () => {
    const biweekly = schedule(6, 2, "2026-01-01T12:00:00.000Z");
    const firstBi = getFirstEligibleDueDate(d("2026-01-01"), 6);
    const due = getNextScheduledDueDateAfter(firstBi, 2, d("2026-03-01"));
    // 8 days later = off-week relative to biweekly cadence
    const later = d(due.toISOString());
    later.setDate(later.getDate() + 8);
    const state = getCheckInDueState(biweekly, later);
    assert.equal(state.isOverdue, true);
    assert.equal(toCheckInCalendarDate(state.currentPeriodDueDate!).getTime(), due.getTime());
    const next = getNextScheduledDueDateAfter(firstBi, 2, due);
    assert.equal(toCheckInCalendarDate(state.nextDueDate!).getTime(), next.getTime());
});

check("Statuses do not overlap (due today)", () => {
    const sat = getNextScheduledDueDateAfter(first, 1, d("2026-06-01"));
    const state = getCheckInDueState(weeklySat, sat);
    assert.equal(state.isDueToday && state.isOverdue, false);
});

check("Midnight/date boundary: dateKey noon dates compare equal for same calendar day", () => {
    const sat = getNextScheduledDueDateAfter(first, 1, d("2026-06-01"));
    const morning = new Date(sat);
    morning.setHours(0, 5, 0, 0);
    const evening = new Date(sat);
    evening.setHours(23, 55, 0, 0);
    const a = getCheckInDueState(weeklySat, morning);
    const b = getCheckInDueState(weeklySat, evening);
    assert.equal(a.isDueToday, true);
    assert.equal(b.isDueToday, true);
    assert.equal(a.outstandingWeekNumber, b.outstandingWeekNumber);
});

check("H1: last year's week-only dismiss does not hide the same week next year", () => {
    const sat = getNextScheduledDueDateAfter(first, 1, d("2026-06-01"));
    const mon = d(sat.toISOString());
    mon.setDate(mon.getDate() + 2);
    const state = getCheckInDueState(weeklySat, mon);
    const week = state.outstandingWeekNumber!;
    const lastYearDismiss = {
        alertKey: buildLegacyCheckInAlertKey("client-1", week),
        action: "dismissed" as const,
        clientId: "client-1",
        category: "check_in_overdue" as const,
        weekNumber: week,
        dateKey: null,
        workoutId: null,
        createdAt: new Date("2025-06-09T12:00:00.000Z"),
    };

    assert.equal(findCheckInDismissAction([lastYearDismiss], "client-1", week, 2026), undefined);

    const stillDue = applyCheckInAttentionOverrides(
        state,
        [lastYearDismiss],
        "client-1",
        week,
        mon,
        new Date()
    );
    assert.equal(stillDue.isOverdue, true);
    assert.ok(buildCheckInAlertKey("client-1", week, 2026).includes("2026-W"));
});

check("H1: same-year legacy dismiss still hides that period", () => {
    const sat = getNextScheduledDueDateAfter(first, 1, d("2026-06-01"));
    const mon = d(sat.toISOString());
    mon.setDate(mon.getDate() + 2);
    const state = getCheckInDueState(weeklySat, mon);
    const week = state.outstandingWeekNumber!;
    const cleared = applyCheckInAttentionOverrides(
        state,
        [{
            alertKey: buildLegacyCheckInAlertKey("client-1", week),
            action: "dismissed",
            clientId: "client-1",
            category: "check_in_overdue",
            weekNumber: week,
            dateKey: null,
            workoutId: null,
            createdAt: mon,
        }],
        "client-1",
        week,
        mon,
        new Date()
    );
    assert.equal(cleared.isOverdue, false);
});

console.log(`\n${passed} checks passed\n`);
