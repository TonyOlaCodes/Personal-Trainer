/**
 * Fixed scheduled check-in periods (Europe/Dublin date keys).
 * Run: npm run test:check-in-periods
 */
import assert from "node:assert/strict";
import {
    defaultCheckInPeriod,
    formatScheduledPeriodLabel,
    listScheduledCheckInPeriods,
    scheduledPeriodContainingDate,
    scheduledPeriodWindow,
} from "../src/lib/checkInPeriods";
import type { CheckInSchedule } from "../src/lib/checkInSchedule";

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

const weeklySaturday: CheckInSchedule = {
    day: 6,
    frequencyWeeks: 1,
    startDate: "2026-01-01",
};

const fortnightlySaturday: CheckInSchedule = {
    day: 6,
    frequencyWeeks: 2,
    startDate: "2026-01-01",
};

console.log("\nScheduled check-in periods\n");

check("weekly Saturday period containing 5 Sep is 30 Aug to 5 Sep", () => {
    const period = scheduledPeriodContainingDate(weeklySaturday, "2026-09-05", "2026-09-05");
    assert.ok(period);
    assert.equal(period.dueDateKey, "2026-09-05");
    assert.equal(period.startDateKey, "2026-08-30");
    assert.equal(period.endDateKey, "2026-09-05");
    assert.equal(period.label, formatScheduledPeriodLabel("2026-08-30", "2026-09-05"));
    assert.match(period.label, /30 Aug to 5 Sep/);
});

check("Sunday 6 Sep defaults to the next weekly period, not the missed Saturday", () => {
    const current = defaultCheckInPeriod(weeklySaturday, "2026-09-06");
    assert.ok(current);
    assert.equal(current.dueDateKey, "2026-09-12");
    assert.equal(current.startDateKey, "2026-09-06");
    assert.equal(current.isCurrent, true);
});

check("missed weekly period remains listed after the next period starts", () => {
    const periods = listScheduledCheckInPeriods(weeklySaturday, "2026-09-06", { past: 2, future: 1 });
    const missed = periods.find((period) => period.dueDateKey === "2026-09-05");
    const current = periods.find((period) => period.isCurrent);
    assert.ok(missed);
    assert.equal(missed.isPast, true);
    assert.ok(current);
    assert.equal(current.dueDateKey, "2026-09-12");
});

check("fortnightly Saturday period containing 5 Sep is 23 Aug to 5 Sep", () => {
    const period = scheduledPeriodContainingDate(fortnightlySaturday, "2026-09-05", "2026-09-05");
    assert.ok(period);
    assert.equal(period.startDateKey, "2026-08-23");
    assert.equal(period.endDateKey, "2026-09-05");
    assert.match(period.label, /23 Aug to 5 Sep/);
});

check("period identity is the due date key, not ISO week", () => {
    const window = scheduledPeriodWindow("2026-09-05", 1);
    assert.deepEqual(window, { startDateKey: "2026-08-30", endDateKey: "2026-09-05" });
});

console.log(`\n${passed} checks passed\n`);
