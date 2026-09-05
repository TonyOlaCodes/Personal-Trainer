/**
 * Historical workout duration estimates.
 * Run: npm run test:workout-duration
 */
import assert from "node:assert/strict";
import {
    averageHistoricalDurationMinutes,
    fallbackPlannedDurationMinutes,
    formatWorkoutDurationEstimate,
    resolveWorkoutDurationEstimate,
} from "../src/lib/workoutDurationEstimate";

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

console.log("\nWorkout duration estimates\n");

check("averages completed sessions of the same workout id", () => {
    const minutes = averageHistoricalDurationMinutes(
        [
            { workoutId: "upper", status: "COMPLETED", duration: 70 },
            { workoutId: "upper", status: "COMPLETED", duration: 74 },
            { workoutId: "lower", status: "COMPLETED", duration: 88 },
            { workoutId: "upper", status: "MISSED", duration: 90 },
            { workoutId: "upper", status: "COMPLETED", duration: 0 },
        ],
        "upper"
    );
    assert.equal(minutes, 72);
});

check("does not invent a historical average when there is no history", () => {
    assert.equal(averageHistoricalDurationMinutes([], "upper"), null);
    const resolved = resolveWorkoutDurationEstimate("upper", [], [{ sets: 12 }]);
    assert.equal(resolved.fromHistory, false);
    assert.equal(resolved.minutes, fallbackPlannedDurationMinutes([{ sets: 12 }]));
});

check("formats the estimate without pretending it is exact", () => {
    assert.equal(formatWorkoutDurationEstimate(72), "≈72 min");
});

console.log(`\n${passed} checks passed\n`);
