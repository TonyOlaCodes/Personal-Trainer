/**
 * Full PR test matrix — strength definitions:
 *   NEW BEST  = beat established best e1RM (strict >)
 *   WEIGHT PR = beat established heaviest weight (strict >)
 *   X REP PR  = beat established heaviest weight at exact rep count (strict >)
 *               First-time rep count is NOT a Rep PR.
 *
 * Run: npm run audit:prs
 */

import assert from "node:assert/strict";
import {
    EMPTY_EXERCISE_RECORDS,
    applySetToRecords,
    cloneExerciseRecords,
    evaluateLiveExercisePrs,
    evaluateSetPr,
    evaluateSessionPrs,
    formatStrengthPrLabel,
    type ExerciseRecords,
    type PrKind,
} from "../src/lib/exercisePrs";
import { calculateOneRM } from "../src/lib/oneRepMax";
import { exerciseIdentityKey } from "../src/lib/exerciseIdentity";

function records(partial: Partial<ExerciseRecords>): ExerciseRecords {
    return {
        bestWeightKg: partial.bestWeightKg ?? null,
        bestWeightReps: partial.bestWeightReps ?? null,
        bestWeightByReps: { ...(partial.bestWeightByReps ?? {}) },
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

console.log("New Best");
check("139 vs hist 140 → nothing; 140 → nothing; 141 → New Best", () => {
    const hist = records({ bestWeightKg: 120, bestWeightReps: 5, bestOneRm: 140, bestWeightByReps: { "5": 120 } });
    // Craft weights/reps whose e1RM brackets 140
    const below = { weightKg: 100, reps: 5, isCompleted: true as const };
    assert.ok(calculateOneRM(below.weightKg, below.reps) < 140);
    assert.equal(evaluateSetPr(below, hist).kinds.includes("oneRm"), false);

    const equalOneRm = calculateOneRM(105, 8);
    const histEq = records({
        bestWeightKg: 120,
        bestWeightReps: 5,
        bestOneRm: equalOneRm,
        bestWeightByReps: { "5": 120, "8": 105 },
    });
    assert.equal(evaluateSetPr({ weightKg: 105, reps: 8, isCompleted: true }, histEq).kinds.includes("oneRm"), false);

    const live = evaluateLiveExercisePrs(
        [
            { weightKg: 115, reps: 8, isCompleted: true }, // e1RM 143 > 140
            { weightKg: 100, reps: 6, isCompleted: true },
            { weightKg: 115, reps: 8, isCompleted: true },
            { weightKg: 120, reps: 8, isCompleted: true }, // higher again
        ],
        hist
    );
    assert.ok(live[0].kinds.includes("oneRm"));
    assert.equal(live[0].label, "NEW BEST");
    assert.ok(!live[1].kinds.includes("oneRm"));
    assert.ok(!live[2].kinds.includes("oneRm"));
    assert.ok(live[3].kinds.includes("oneRm"));
});

console.log("Weight PR");
check("Matrix: 119/120 nothing, 125 PR, 122.5/125 nothing, 130 PR", () => {
    const hist = fromSets([{ w: 120, r: 5 }]);
    const live = evaluateLiveExercisePrs(
        [
            { weightKg: 119, reps: 5, isCompleted: true },
            { weightKg: 120, reps: 5, isCompleted: true },
            { weightKg: 125, reps: 3, isCompleted: true },
            { weightKg: 122.5, reps: 5, isCompleted: true },
            { weightKg: 125, reps: 4, isCompleted: true },
            { weightKg: 130, reps: 1, isCompleted: true },
        ],
        hist
    );
    assert.ok(!live[0].kinds.includes("weight"));
    assert.ok(!live[1].kinds.includes("weight"));
    assert.ok(live[2].kinds.includes("weight"));
    assert.ok(!live[3].kinds.includes("weight"));
    assert.ok(!live[4].kinds.includes("weight"));
    assert.ok(live[5].kinds.includes("weight"));
});

console.log("8 Rep PR");
check("Matrix for exact 8-rep weight records", () => {
    const hist = fromSets([{ w: 100, r: 8 }]);
    const live = evaluateLiveExercisePrs(
        [
            { weightKg: 100, reps: 8, isCompleted: true },
            { weightKg: 102.5, reps: 8, isCompleted: true },
            { weightKg: 101, reps: 8, isCompleted: true },
            { weightKg: 102.5, reps: 8, isCompleted: true },
            { weightKg: 105, reps: 8, isCompleted: true },
        ],
        hist
    );
    assert.ok(!live[0].kinds.includes("reps"));
    assert.ok(live[1].kinds.includes("reps"));
    // Heavier at same reps usually also raises e1RM → main badge NEW BEST
    assert.ok(live[1].label === "8 REP PR" || live[1].label === "NEW BEST");
    assert.ok(!live[2].kinds.includes("reps"));
    assert.ok(!live[3].kinds.includes("reps"));
    assert.ok(live[4].kinds.includes("reps"));
});

console.log("Different rep counts");
check("8-rep and 5-rep records are independent", () => {
    const hist = fromSets([
        { w: 100, r: 8 },
        { w: 110, r: 5 },
    ]);
    // Cap e1RM / weight so these stay Rep-only badges
    hist.bestOneRm = 999;
    hist.bestWeightKg = 200;
    const a = evaluateSetPr({ weightKg: 102.5, reps: 8, isCompleted: true }, hist);
    const b = evaluateSetPr({ weightKg: 112.5, reps: 5, isCompleted: true }, hist);
    assert.ok(a.kinds.includes("reps"));
    assert.equal(a.label, "8 REP PR");
    assert.ok(b.kinds.includes("reps"));
    assert.equal(b.label, "5 REP PR");
});

console.log("First-time rep count");
check("First ever 7-rep set is not a Rep PR", () => {
    const hist = fromSets([
        { w: 100, r: 8 },
        { w: 120, r: 5 },
    ]);
    const pr = evaluateSetPr({ weightKg: 100, reps: 7, isCompleted: true }, hist);
    assert.ok(!pr.kinds.includes("reps"));
});

console.log("Multiple types");
check("125×8 can be NEW_BEST + WEIGHT + REP; badge NEW BEST", () => {
    const hist = fromSets([
        { w: 120, r: 5 },
        { w: 115, r: 8 },
    ]);
    // Ensure hist bestOneRm is below 125×8
    const e1 = calculateOneRM(125, 8);
    assert.ok(e1 > (hist.bestOneRm ?? 0));
    const pr = evaluateSetPr({ weightKg: 125, reps: 8, isCompleted: true }, hist);
    assert.ok(pr.kinds.includes("oneRm"));
    assert.ok(pr.kinds.includes("weight"));
    assert.ok(pr.kinds.includes("reps"));
    assertKind(pr.kind, "oneRm", "display");
    assert.equal(pr.label, "NEW BEST");
    assert.ok(pr.alsoKinds?.includes("weight"));
    assert.ok(pr.alsoKinds?.includes("reps"));
});

console.log("Matching");
check("Equal weight/reps/e1RM shows nothing", () => {
    const hist = fromSets([{ w: 105, r: 8 }]);
    const pr = evaluateSetPr({ weightKg: 105, reps: 8, isCompleted: true }, hist);
    assert.equal(pr.isPr, false);
});

console.log("Current session");
check("Session board advances for 8-rep PRs", () => {
    const hist = fromSets([{ w: 100, r: 8 }]);
    const live = evaluateLiveExercisePrs(
        [
            { weightKg: 105, reps: 8, isCompleted: true },
            { weightKg: 102.5, reps: 8, isCompleted: true },
            { weightKg: 107.5, reps: 8, isCompleted: true },
            { weightKg: 105, reps: 8, isCompleted: true },
            { weightKg: 110, reps: 8, isCompleted: true },
        ],
        hist
    );
    assert.ok(live[0].kinds.includes("reps"));
    assert.ok(!live[1].kinds.includes("reps"));
    assert.ok(live[2].kinds.includes("reps"));
    assert.ok(!live[3].kinds.includes("reps"));
    assert.ok(live[4].kinds.includes("reps"));
});

console.log("Refresh / resume");
check("Baseline includes earlier session sets (simulated resume)", () => {
    const hist = fromSets([{ w: 100, r: 8 }]);
    // After refresh, earlier sets are part of live evaluation input
    const live = evaluateLiveExercisePrs(
        [
            { weightKg: 105, reps: 8, isCompleted: true },
            { weightKg: 102.5, reps: 8, isCompleted: true },
        ],
        hist
    );
    assert.ok(live[0].kinds.includes("reps"));
    assert.ok(!live[1].isPr || !live[1].kinds.includes("reps"));
});

console.log("Edit");
check("Editing a PR set down removes the badge on recalc", () => {
    const hist = fromSets([{ w: 100, r: 8 }]);
    const before = evaluateLiveExercisePrs(
        [{ weightKg: 105, reps: 8, isCompleted: true }],
        hist
    );
    assert.ok(before[0].kinds.includes("reps"));
    const after = evaluateLiveExercisePrs(
        [{ weightKg: 95, reps: 8, isCompleted: true }],
        hist
    );
    assert.ok(!after[0].kinds.includes("reps"));
});

console.log("Delete");
check("Deleting earlier PR set recalculates later set vs history", () => {
    const hist = fromSets([{ w: 100, r: 8 }]);
    const withBoth = evaluateLiveExercisePrs(
        [
            { weightKg: 105, reps: 8, isCompleted: true },
            { weightKg: 107.5, reps: 8, isCompleted: true },
        ],
        hist
    );
    assert.ok(withBoth[0].kinds.includes("reps"));
    assert.ok(withBoth[1].kinds.includes("reps"));
    // Delete set 1 — only set 2 remains
    const afterDelete = evaluateLiveExercisePrs(
        [{ weightKg: 107.5, reps: 8, isCompleted: true }],
        hist
    );
    assert.ok(afterDelete[0].kinds.includes("reps"));
});

console.log("Warm-up");
check("Warm-up exceeding record is not a PR and does not raise board", () => {
    const hist = fromSets([{ w: 100, r: 5 }]);
    const live = evaluateLiveExercisePrs(
        [
            { weightKg: 200, reps: 1, isWarmup: true, isCompleted: true },
            { weightKg: 105, reps: 5, isCompleted: true },
        ],
        hist
    );
    assert.equal(live[0].isPr, false);
    // 105 still beats hist 100 → Weight PR (warmup must not have raised board to 200)
    assert.ok(live[1].kinds.includes("weight"));
});

console.log("Alias identity");
check("Pull Ups history shares identity with Pull Up", () => {
    const hist = fromSets([{ w: 20, r: 8 }]);
    const keyA = exerciseIdentityKey("Pull Ups");
    const keyB = exerciseIdentityKey("Pull Up");
    assert.equal(keyA, keyB);
    const pr = evaluateSetPr({ weightKg: 17.5, reps: 8, isCompleted: true }, hist);
    assert.ok(!pr.kinds.includes("reps"));
});

console.log("Labels / priority");
check("formatStrengthPrLabel and Weight+Rep without New Best", () => {
    assert.equal(formatStrengthPrLabel("oneRm"), "NEW BEST");
    assert.equal(formatStrengthPrLabel("weight"), "WEIGHT PR");
    assert.equal(formatStrengthPrLabel("reps", 8), "8 REP PR");

    // Heavy weight at few reps can raise weight without raising e1RM over a high-rep best
    const hist = records({
        bestWeightKg: 120,
        bestWeightReps: 5,
        bestOneRm: 200,
        bestWeightByReps: { "5": 120, "2": 118 },
    });
    const pr = evaluateSetPr({ weightKg: 125, reps: 2, isCompleted: true }, hist);
    assert.ok(pr.kinds.includes("weight"));
    assert.ok(!pr.kinds.includes("oneRm"));
    assertKind(pr.kind, "weight", "weight over reps when no oneRm");
    assert.equal(pr.label, "WEIGHT PR");
});

console.log("First set establishes only");
check("First-ever set on empty board is not a PR", () => {
    const pr = evaluateSetPr(
        { weightKg: 100, reps: 8, isCompleted: true },
        cloneExerciseRecords(EMPTY_EXERCISE_RECORDS)
    );
    assert.equal(pr.isPr, false);
});

console.log("Session helper");
check("evaluateSessionPrs agrees with live ordering", () => {
    const hist = fromSets([{ w: 100, r: 8 }]);
    const key = exerciseIdentityKey("Bench Press")!;
    const sets = [
        { exerciseName: "Bench Press", weightKg: 105, reps: 8, isCompleted: true },
        { exerciseName: "Bench Press", weightKg: 102.5, reps: 8, isCompleted: true },
        { exerciseName: "Bench Press", weightKg: 107.5, reps: 8, isCompleted: true },
    ];
    const session = evaluateSessionPrs(sets, { [key]: hist });
    const live = evaluateLiveExercisePrs(sets, hist);
    assert.equal(session[0].pr.isPr, live[0].isPr);
    assert.equal(session[1].pr.isPr, live[1].isPr);
    assert.equal(session[2].pr.isPr, live[2].isPr);
});

console.log(`\nAll ${passed} PR audit checks passed.`);
