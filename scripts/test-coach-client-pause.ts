/**
 * Unit checks for coach-only client pause helpers.
 * Run: npx tsx scripts/test-coach-client-pause.ts
 */
import assert from "node:assert/strict";
import {
    isClientPausedByCoach,
    shouldSuppressCoachMissedAttention,
} from "../src/lib/coachClientPause";

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

console.log("\nCoach client pause tests\n");

check("active client is not paused", () => {
    assert.equal(isClientPausedByCoach({ isCoachPaused: false }), false);
    assert.equal(isClientPausedByCoach({}), false);
});

check("paused client suppresses all missed attention", () => {
    assert.equal(
        shouldSuppressCoachMissedAttention({ isCoachPaused: true }, "2026-08-10"),
        true
    );
});

check("after resume, events before resume day are suppressed (no backlog)", () => {
    assert.equal(
        shouldSuppressCoachMissedAttention(
            { isCoachPaused: false, coachResumedAt: new Date("2026-08-15T12:00:00.000Z") },
            "2026-08-10"
        ),
        true
    );
});

check("after resume, events on/after resume day are not suppressed", () => {
    assert.equal(
        shouldSuppressCoachMissedAttention(
            { isCoachPaused: false, coachResumedAt: new Date("2026-08-15T12:00:00.000Z") },
            "2026-08-15"
        ),
        false
    );
    assert.equal(
        shouldSuppressCoachMissedAttention(
            { isCoachPaused: false, coachResumedAt: new Date("2026-08-15T12:00:00.000Z") },
            "2026-08-16"
        ),
        false
    );
});

check("never resumed active client keeps normal alerts", () => {
    assert.equal(
        shouldSuppressCoachMissedAttention({ isCoachPaused: false, coachResumedAt: null }, "2026-08-10"),
        false
    );
});

console.log(`\n${passed} checks passed\n`);
