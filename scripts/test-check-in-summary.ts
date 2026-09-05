/**
 * Check-in summary period + lifestyle scoring (no DB).
 * Run: npm run test:check-in-summary
 */
import assert from "node:assert/strict";
import { getCheckInAnalysisWindow } from "../src/lib/checkInPeriodSummary";
import {
    hasEnoughLifestyleAssessmentData,
    resolveLifestyleVerdict,
    buildLifestyleCheckInCopy,
} from "../src/lib/checkInLifestyleNotes";
import { summarizeLifestylePeriod } from "../src/lib/lifestylePeriodMetrics";
import { expectedDaysInWindow } from "../src/lib/coachClientPeriodStats";

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

console.log("check-in summary");

check("analysis window starts the day after the previous check-in", () => {
    const window = getCheckInAnalysisWindow("2026-09-05", "2026-08-29", "2026-01-01");
    assert.deepEqual(window, { startDateKey: "2026-08-30", endDateKey: "2026-09-05" });
    assert.equal(expectedDaysInWindow(window.startDateKey, window.endDateKey, "2026-01-01"), 7);
});

check("first check-in uses account start", () => {
    const window = getCheckInAnalysisWindow("2026-09-05", null, "2026-08-20");
    assert.deepEqual(window, { startDateKey: "2026-08-20", endDateKey: "2026-09-05" });
});

check("2/7 logged days is not enough for an assessment", () => {
    assert.equal(hasEnoughLifestyleAssessmentData(2, 7), false);
    assert.equal(hasEnoughLifestyleAssessmentData(3, 7), true);
});

check("missing days are excluded from the average; logged 0 still counts", () => {
    const summary = summarizeLifestylePeriod(
        [
            { date: "2026-08-30", calories: 4000, steps: 5000, sleepHours: 8 },
            { date: "2026-08-31", calories: 0, steps: 0, sleepHours: 0 },
        ],
        { targetCalories: 4000, targetSteps: 5000, targetSleepHours: 8 },
        7
    );
    assert.equal(summary.calories.loggedDays, 2);
    assert.equal(summary.calories.average, 2000);
    assert.equal(summary.steps.average, 2500);
    assert.equal(summary.sleep.average, 4);
    assert.equal(summary.calories.expectedDays, 7);
});

check("calories are goal-aware: close is good, far below is low, far above is high", () => {
    const close = summarizeLifestylePeriod(
        [
            { date: "2026-09-01", calories: 3900, steps: null, sleepHours: null },
            { date: "2026-09-02", calories: 4100, steps: null, sleepHours: null },
            { date: "2026-09-03", calories: 3950, steps: null, sleepHours: null },
        ],
        { targetCalories: 4000, targetSteps: null, targetSleepHours: null },
        7
    ).calories;
    assert.equal(resolveLifestyleVerdict("calories", close, true), "good");

    const low = summarizeLifestylePeriod(
        [
            { date: "2026-09-01", calories: 2800, steps: null, sleepHours: null },
            { date: "2026-09-02", calories: 2700, steps: null, sleepHours: null },
            { date: "2026-09-03", calories: 2600, steps: null, sleepHours: null },
        ],
        { targetCalories: 4000, targetSteps: null, targetSleepHours: null },
        7
    ).calories;
    assert.equal(resolveLifestyleVerdict("calories", low, true), "low");

    const high = summarizeLifestylePeriod(
        [
            { date: "2026-09-01", calories: 5200, steps: null, sleepHours: null },
            { date: "2026-09-02", calories: 5300, steps: null, sleepHours: null },
            { date: "2026-09-03", calories: 5400, steps: null, sleepHours: null },
        ],
        { targetCalories: 4000, targetSteps: null, targetSleepHours: null },
        7
    ).calories;
    assert.equal(resolveLifestyleVerdict("calories", high, true), "high");
});

check("steps compare against the goal and do not invent zeros", () => {
    const steps = summarizeLifestylePeriod(
        [
            { date: "2026-09-01", calories: null, steps: 3900, sleepHours: null },
            { date: "2026-09-02", calories: null, steps: 3800, sleepHours: null },
            { date: "2026-09-03", calories: null, steps: 4000, sleepHours: null },
        ],
        { targetCalories: null, targetSteps: 5000, targetSleepHours: null },
        7
    ).steps;
    assert.equal(steps.average, 3900);
    assert.equal(steps.loggedDays, 3);
    assert.equal(resolveLifestyleVerdict("steps", steps, true), "low");
});

check("sleep is not scored as more-is-better", () => {
    const long = summarizeLifestylePeriod(
        [
            { date: "2026-09-01", calories: null, steps: null, sleepHours: 12 },
            { date: "2026-09-02", calories: null, steps: null, sleepHours: 13 },
            { date: "2026-09-03", calories: null, steps: null, sleepHours: 12 },
        ],
        { targetCalories: null, targetSteps: null, targetSleepHours: 8 },
        7
    ).sleep;
    assert.equal(resolveLifestyleVerdict("sleep", long, true), "high");

    const onTarget = summarizeLifestylePeriod(
        [
            { date: "2026-09-01", calories: null, steps: null, sleepHours: 7.8 },
            { date: "2026-09-02", calories: null, steps: null, sleepHours: 8.1 },
            { date: "2026-09-03", calories: null, steps: null, sleepHours: 8 },
        ],
        { targetCalories: null, targetSteps: null, targetSleepHours: 8 },
        7
    ).sleep;
    assert.equal(resolveLifestyleVerdict("sleep", onTarget, true), "good");
});

check("insufficient data copy does not invent an assessment", () => {
    const thin = summarizeLifestylePeriod(
        [
            { date: "2026-09-01", calories: null, steps: 2000, sleepHours: null },
            { date: "2026-09-02", calories: null, steps: 2100, sleepHours: null },
        ],
        { targetCalories: null, targetSteps: 5000, targetSleepHours: null },
        7
    ).steps;
    const verdict = resolveLifestyleVerdict("steps", thin, hasEnoughLifestyleAssessmentData(thin.loggedDays, thin.expectedDays));
    assert.equal(verdict, "insufficient");
    const copy = buildLifestyleCheckInCopy("steps", thin, verdict);
    assert.match(copy.message, /Not enough data yet/i);
    assert.doesNotMatch(copy.detail, /No enough/i);
});

console.log(`\n${passed} checks passed`);
