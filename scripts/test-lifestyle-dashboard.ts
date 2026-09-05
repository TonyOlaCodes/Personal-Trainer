/**
 * Lifestyle dashboard visibility + daily-metric merge (no DB).
 * Run: npm run test:lifestyle-dashboard
 */
import assert from "node:assert/strict";
import { mergeDailyMetricsPatch } from "../src/lib/dailyMetrics";
import {
    isLifestyleShownOnDashboard,
    lifestyleDashboardGridClass,
    lifestyleMetricInputPlaceholder,
    sanitizeHiddenGoals,
    setLifestyleDashboardHidden,
    visibleLifestyleDashboardKeys,
} from "../src/lib/lifestyleDashboardVisibility";
import {
    formatLifestyleLoggedCount,
    lifestyleLoggingRatePercent,
    summarizeLifestylePeriod,
} from "../src/lib/lifestylePeriodMetrics";

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

console.log("\nLifestyle dashboard visibility\n");

check("onboarding default hides calories, steps, and sleep", () => {
    assert.deepEqual(visibleLifestyleDashboardKeys(["calories", "steps", "sleep"]), []);
});

check("empty hiddenGoals shows all three lifestyle cards", () => {
    assert.deepEqual(visibleLifestyleDashboardKeys([]), ["calories", "steps", "sleep"]);
});

check("toggling Show on Dashboard only changes that key", () => {
    const hidden = ["calories", "steps", "sleep"];
    const shownSteps = setLifestyleDashboardHidden(hidden, "steps", true);
    assert.deepEqual(shownSteps, ["calories", "sleep"]);
    assert.equal(isLifestyleShownOnDashboard(shownSteps, "steps"), true);
    assert.equal(isLifestyleShownOnDashboard(shownSteps, "calories"), false);
});

check("grid uses the visible card count, not empty columns", () => {
    assert.equal(lifestyleDashboardGridClass(1), "grid grid-cols-1");
    assert.equal(lifestyleDashboardGridClass(2), "grid grid-cols-2");
    assert.equal(lifestyleDashboardGridClass(3), "grid grid-cols-3");
});

check("unlogged inputs hint the goal without treating it as a log", () => {
    assert.equal(lifestyleMetricInputPlaceholder("calories", 4000), "4,000 kcal");
    assert.equal(lifestyleMetricInputPlaceholder("steps", 5000), "5,000 steps");
    assert.equal(lifestyleMetricInputPlaceholder("sleep", 8), "8 hrs");
    assert.equal(lifestyleMetricInputPlaceholder("sleep", 7.5), "7.5 hrs");
    assert.equal(lifestyleMetricInputPlaceholder("calories", null), "kcal");
    assert.equal(lifestyleMetricInputPlaceholder("steps", undefined), "steps");
    assert.equal(lifestyleMetricInputPlaceholder("sleep", null), "hrs");
});

check("saving one metric does not wipe the others", () => {
    const merged = mergeDailyMetricsPatch(
        { calories: 2400, steps: 8000, sleepHours: 7.5 },
        { steps: 0 }
    );
    assert.equal(merged.calories, 2400);
    assert.equal(merged.steps, 0);
    assert.equal(merged.sleepHours, 7.5);
});

check("logged zero stays zero in period averages", () => {
    const summary = summarizeLifestylePeriod(
        [{ date: "2026-09-05", calories: 0, steps: 0, sleepHours: 0 }],
        { targetCalories: 2500, targetSteps: 10000, targetSleepHours: 8 },
        1
    );
    assert.equal(summary.calories.average, 0);
    assert.equal(summary.steps.average, 0);
    assert.equal(summary.sleep.average, 0);
    assert.equal(summary.calories.loggedDays, 1);
});

check("missing days are not treated as zero", () => {
    const summary = summarizeLifestylePeriod(
        [
            { date: "2026-09-04", calories: 2000, steps: null, sleepHours: null },
            { date: "2026-09-05", calories: null, steps: null, sleepHours: null },
        ],
        { targetCalories: 2000, targetSteps: 8000, targetSleepHours: 8 },
        2
    );
    assert.equal(summary.calories.average, 2000);
    assert.equal(summary.calories.loggedDays, 1);
    assert.equal(summary.steps.average, null);
    assert.equal(summary.steps.loggedDays, 0);
});

check("sanitizeHiddenGoals keeps only known keys", () => {
    assert.deepEqual(sanitizeHiddenGoals(["calories", "nope", "weight", "calories"]), ["calories", "weight"]);
});

check("logging rate is logged/expected, not on-target days", () => {
    assert.equal(lifestyleLoggingRatePercent(4, 82), 5);
    assert.equal(lifestyleLoggingRatePercent(82, 82), 100);
    assert.equal(lifestyleLoggingRatePercent(0, 82), 0);
    assert.equal(formatLifestyleLoggedCount(4, 82), "4/82 · 5%");
    assert.equal(formatLifestyleLoggedCount(0, 82), "0/82 · 0%");
});

check("on-target percent uses logged days only", () => {
    const summary = summarizeLifestylePeriod(
        [
            { date: "2026-09-01", calories: 4000, steps: 10000, sleepHours: 8 },
            { date: "2026-09-02", calories: 3961, steps: 12000, sleepHours: 7.8 },
            { date: "2026-09-03", calories: 4100, steps: 11000, sleepHours: 8.2 },
            { date: "2026-09-04", calories: 3900, steps: 10500, sleepHours: 8 },
        ],
        { targetCalories: 4000, targetSteps: 10000, targetSleepHours: 8 },
        82
    );
    assert.equal(summary.calories.loggedDays, 4);
    assert.equal(summary.calories.expectedDays, 82);
    assert.equal(summary.calories.loggingRatePercent, 5);
    assert.equal(summary.calories.adherencePercent, 100);
    assert.equal(summary.steps.loggedDays, 4);
    assert.equal(summary.sleep.average != null, true);
});

check("no logs leave average and on-target empty", () => {
    const summary = summarizeLifestylePeriod(
        [],
        { targetCalories: 5000, targetSteps: 8000, targetSleepHours: 8 },
        82
    );
    assert.equal(summary.calories.average, null);
    assert.equal(summary.calories.adherencePercent, null);
    assert.equal(summary.calories.loggedDays, 0);
    assert.equal(summary.calories.loggingRatePercent, 0);
    assert.equal(summary.calories.target, 5000);
});

console.log(`\n${passed} passed\n`);
