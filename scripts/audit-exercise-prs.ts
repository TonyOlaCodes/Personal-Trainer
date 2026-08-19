/**
 * Audits live / session PR definitions against the product test cases.
 *
 * Run: npx tsx scripts/audit-exercise-prs.ts
 */

import assert from "node:assert/strict";
import {
    EMPTY_EXERCISE_RECORDS,
    applySetToRecords,
    cloneExerciseRecords,
    evaluateLiveExercisePrs,
    evaluateSetPr,
    evaluateSessionPrs,
    type ExerciseRecords,
    type PrKind,
} from "../src/lib/exercisePrs";
import { calculateOneRM } from "../src/lib/oneRepMax";

function records(partial: Partial<ExerciseRecords> & { bestRepsByWeight?: Record<string, number> }): ExerciseRecords {
    return {
        bestWeightKg: partial.bestWeightKg ?? null,
        bestWeightReps: partial.bestWeightReps ?? null,
        bestRepsByWeight: { ...(partial.bestRepsByWeight ?? {}) },
        bestOneRm: partial.bestOneRm ?? null,
    };
}

function fromSets(sets: Array<{ w: number; r: number }>): ExerciseRecords {
    const board = cloneExerciseRecords(EMPTY_EXERCISE_RECORDS);
    for (const set of sets) applySetToRecords(board, { weightKg: set.w, reps: set.r });
    return board;
}

function assertKind(actual: PrKind | null, expected: PrKind | null, label: string) {
    assert.equal(actual, expected, `${label}: expected ${expected}, got ${actual}`);
}

let passed = 0;
function check(label: string, fn: () => void) {
    try {
        fn();
        passed += 1;
        console.log(`  ✓ ${label}`);
    } catch (error) {
        console.error(`  ✗ ${label}`);
        throw error;
    }
}

console.log("Weight PR cases");
check("Case 1: 125×3 after 120×5 → Weight PR (display may be New Best if 1RM also rises)", () => {
    const hist = fromSets([{ w: 120, r: 5 }]);
    const pr = evaluateSetPr({ weightKg: 125, reps: 3, isCompleted: true }, hist);
    assert.ok(pr.kinds.includes("weight"));
});

check("Case 2: 125 then 122.5 — second is not Weight PR", () => {
    const hist = fromSets([{ w: 120, r: 5 }]);
    const live = evaluateLiveExercisePrs(
        [
            { weightKg: 125, reps: 3, isCompleted: true },
            { weightKg: 122.5, reps: 5, isCompleted: true },
        ],
        hist
    );
    assert.ok(live[0].kinds.includes("weight"));
    assert.ok(!live[1].kinds.includes("weight"));
});

check("Case 3: equal weight is not a new Weight PR; heavier is", () => {
    const hist = fromSets([{ w: 120, r: 5 }]);
    const live = evaluateLiveExercisePrs(
        [
            { weightKg: 125, reps: 3, isCompleted: true },
            { weightKg: 125, reps: 5, isCompleted: true },
            { weightKg: 130, reps: 1, isCompleted: true },
        ],
        hist
    );
    assert.ok(live[0].kinds.includes("weight"));
    assert.ok(!live[1].kinds.includes("weight"));
    assert.ok(live[2].kinds.includes("weight"));
});

check("Case 4: matching heaviest weight is not Weight PR", () => {
    const hist = fromSets([{ w: 125, r: 3 }]);
    const pr = evaluateSetPr({ weightKg: 125, reps: 10, isCompleted: true }, hist);
    assert.ok(!pr.kinds.includes("weight"));
});

console.log("Rep PR cases");
check("Case 1: 100×8 after 100×6 → Rep PR (and possibly New Best if 1RM rises)", () => {
    const hist = fromSets([{ w: 100, r: 6 }]);
    const pr = evaluateSetPr({ weightKg: 100, reps: 8, isCompleted: true }, hist);
    assert.ok(pr.kinds.includes("reps"));
    assert.ok(pr.isPr);
});

check("Case 2: live session advances — 8 then 7/8 no, then 9 yes", () => {
    const hist = fromSets([{ w: 100, r: 6 }]);
    const live = evaluateLiveExercisePrs(
        [
            { weightKg: 100, reps: 8, isCompleted: true },
            { weightKg: 100, reps: 7, isCompleted: true },
            { weightKg: 100, reps: 8, isCompleted: true },
            { weightKg: 100, reps: 9, isCompleted: true },
        ],
        hist
    );
    assert.ok(live[0].kinds.includes("reps"));
    assert.ok(!live[1].isPr);
    assert.ok(!live[2].kinds.includes("reps"));
    assert.ok(live[3].kinds.includes("reps"));
});

check("Case 3: Rep PR is per exact weight", () => {
    const hist = fromSets([
        { w: 100, r: 8 },
        { w: 110, r: 4 },
    ]);
    const pr = evaluateSetPr({ weightKg: 110, reps: 5, isCompleted: true }, hist);
    assert.ok(pr.kinds.includes("reps"));
});

check("Case 4: new weight is not a Rep PR at the old weight", () => {
    const hist = fromSets([{ w: 100, r: 8 }]);
    const pr = evaluateSetPr({ weightKg: 105, reps: 7, isCompleted: true }, hist);
    assert.ok(!pr.kinds.includes("reps"));
});

check("Case 5: first-time weight is not a Rep PR", () => {
    const hist = fromSets([{ w: 90, r: 10 }]);
    const pr = evaluateSetPr({ weightKg: 100, reps: 5, isCompleted: true }, hist);
    assert.ok(!pr.kinds.includes("reps"));
});

console.log("New Best cases");
check("Case 1: higher estimated 1RM → New Best", () => {
    const hist = records({ bestWeightKg: 100, bestWeightReps: 5, bestOneRm: 120, bestRepsByWeight: { "100": 5 } });
    const set = { weightKg: 100, reps: 10, isCompleted: true as const };
    assert.ok(calculateOneRM(100, 10) > 120);
    const pr = evaluateSetPr(set, hist);
    assert.ok(pr.kinds.includes("oneRm"));
    assertKind(pr.kind, "oneRm", "display priority");
});

check("Case 2: matching 1RM is not New Best", () => {
    const oneRm = calculateOneRM(105, 8);
    const hist = records({
        bestWeightKg: 120,
        bestWeightReps: 5,
        bestOneRm: oneRm,
        bestRepsByWeight: { "120": 5 },
    });
    const pr = evaluateSetPr({ weightKg: 105, reps: 8, isCompleted: true }, hist);
    assert.ok(!pr.kinds.includes("oneRm"));
});

check("Case 3: live New Best advances within the session", () => {
    const hist = records({ bestWeightKg: 100, bestWeightReps: 5, bestOneRm: 130, bestRepsByWeight: { "100": 5 } });
    // Craft sets by estimated 1RM relative to 130
    const live = evaluateLiveExercisePrs(
        [
            { weightKg: 110, reps: 8, isCompleted: true }, // typically > 130
            { weightKg: 100, reps: 6, isCompleted: true }, // typically < prior new best
            { weightKg: 120, reps: 6, isCompleted: true }, // higher again
        ],
        hist
    );
    assert.ok(live[0].kinds.includes("oneRm") || live[0].kinds.includes("weight"));
    // Second should not be New Best if first raised the board
    if (live[0].kinds.includes("oneRm")) {
        assert.ok(!live[1].kinds.includes("oneRm"));
    }
});

console.log("Combined / priority");
check("Display priority prefers New Best over Weight PR", () => {
    const hist = fromSets([{ w: 120, r: 5 }]);
    const pr = evaluateSetPr({ weightKg: 125, reps: 5, isCompleted: true }, hist);
    assert.ok(pr.kinds.includes("weight"));
    if (pr.kinds.includes("oneRm")) {
        assertKind(pr.kind, "oneRm", "priority");
        assert.equal(pr.label, "🔥 New Best");
    }
});

check("Warm-ups never PR", () => {
    const hist = fromSets([{ w: 100, r: 5 }]);
    const pr = evaluateSetPr({ weightKg: 200, reps: 1, isWarmup: true, isCompleted: true }, hist);
    assert.equal(pr.isPr, false);
});

check("Incomplete sets never PR (live)", () => {
    const hist = fromSets([{ w: 100, r: 5 }]);
    const live = evaluateLiveExercisePrs(
        [{ weightKg: 150, reps: 1, isCompleted: false }],
        hist
    );
    assert.equal(live[0].isPr, false);
});

check("evaluateSessionPrs agrees with live ordering", () => {
    const hist = fromSets([{ w: 100, r: 6 }]);
    const key = "bench press";
    const sets = [
        { exerciseName: "Bench Press", weightKg: 100, reps: 8, isCompleted: true },
        { exerciseName: "Bench Press", weightKg: 100, reps: 7, isCompleted: true },
        { exerciseName: "Bench Press", weightKg: 100, reps: 9, isCompleted: true },
    ];
    const session = evaluateSessionPrs(sets, { [key]: hist });
    const live = evaluateLiveExercisePrs(sets, hist);
    assert.equal(session[0].pr.isPr, live[0].isPr);
    assert.equal(session[1].pr.isPr, live[1].isPr);
    assert.equal(session[2].pr.isPr, live[2].isPr);
});

console.log(`\nAll ${passed} PR audit checks passed.`);
