/**
 * Lifestyle dashboard visibility + daily-metric merge (no DB).
 * Run: npm run test:lifestyle-dashboard
 */
import assert from "node:assert/strict";
import { mergeDailyMetricsPatch } from "../src/lib/dailyMetrics";
import {
    isLifestyleShownOnDashboard,
    lifestyleDashboardGridClass,
    sanitizeHiddenGoals,
    setLifestyleDashboardHidden,
    visibleLifestyleDashboardKeys,
} from "../src/lib/lifestyleDashboardVisibility";
import { summarizeLifestylePeriod } from "../src/lib/lifestylePeriodMetrics";

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
    assert.equal(lifestyleDashboardGridClass(2), "grid grid-cols-1 sm:grid-cols-2");
    assert.equal(lifestyleDashboardGridClass(3), "grid grid-cols-1 sm:grid-cols-3");
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

console.log(`\n${passed} passed\n`);
