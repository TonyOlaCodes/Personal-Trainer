/**
 * Shared exercise search (no DB).
 * Run: npm run test:exercise-search
 */
import assert from "node:assert/strict";
import {
    exerciseMatchesQuery,
    searchExerciseNames,
    searchExercises,
    scoreExerciseMatch,
} from "../src/lib/exerciseSearch";

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

const catalog = [
    "Barbell Bench Press",
    "Incline Dumbbell Bench Press",
    "Incline Dumbbell Chest Fly",
    "Single Arm Cable Curl",
    "Lateral Raise",
    "Dumbbell Lateral Raise",
    "Pull-Up",
    "Lat Pulldown",
    "Seated Cable Row",
    "Squat",
];

function names(query: string) {
    return searchExerciseNames(query, catalog);
}

console.log("exercise search");

check("exact name ranks first", () => {
    const results = names("Barbell Bench Press");
    assert.equal(results[0], "Barbell Bench Press");
});

check("partial name finds relevant benches", () => {
    const results = names("bench");
    assert.ok(results.includes("Barbell Bench Press"));
    assert.ok(results.includes("Incline Dumbbell Bench Press"));
    assert.ok(!results.includes("Squat"));
});

check("incline dumbbell finds both incline dumbbell moves", () => {
    const results = names("incline dumbbell");
    assert.ok(results.includes("Incline Dumbbell Bench Press"));
    assert.ok(results.includes("Incline Dumbbell Chest Fly"));
});

check("reversed word order still matches", () => {
    const results = names("dumbbell incline");
    assert.ok(results.includes("Incline Dumbbell Bench Press"));
});

check("bench press barbell finds barbell bench press", () => {
    const results = names("Bench Press Barbell");
    assert.ok(results.includes("Barbell Bench Press"));
});

check("single cable curl finds single arm cable curl", () => {
    const results = names("single cable curl");
    assert.ok(results.includes("Single Arm Cable Curl"));
});

check("lat raise finds lateral raise exercises", () => {
    const results = names("lat raise");
    assert.ok(results.includes("Lateral Raise"));
    assert.ok(results.includes("Dumbbell Lateral Raise"));
});

check("pull up matches Pull-Up", () => {
    const results = names("pull up");
    assert.ok(results.includes("Pull-Up"));
});

check("pull-up matches Pull-Up", () => {
    const results = names("pull-up");
    assert.ok(results.includes("Pull-Up"));
});

check("different capitalization", () => {
    const results = names("BARBELL bench PRESS");
    assert.ok(results.includes("Barbell Bench Press"));
});

check("extra spaces", () => {
    const results = names("  incline    dumbbell  ");
    assert.ok(results.includes("Incline Dumbbell Bench Press"));
});

check("alias bench press finds barbell bench press", () => {
    const results = searchExercises(
        "Bench Press",
        catalog.map((name) => ({ name })),
        catalog.length,
        { aliases: [{ alias: "Bench Press", name: "Barbell Bench Press" }] }
    ).map((item) => item.name);
    assert.ok(results.includes("Barbell Bench Press"));
});

check("identity alias still finds canonical name", () => {
    const results = names("bench press");
    assert.ok(results.includes("Barbell Bench Press"));
});

check("special regex characters do not throw or empty the world", () => {
    assert.doesNotThrow(() => names("bench("));
    assert.doesNotThrow(() => names("[*+?"));
    assert.doesNotThrow(() => names("..."));
    const results = names("bench(");
    assert.ok(results.includes("Barbell Bench Press"));
});

check("empty search returns the full list", () => {
    const results = names("   ");
    assert.deepEqual(results, catalog);
});

check("exerciseMatchesQuery is true for empty query", () => {
    assert.equal(exerciseMatchesQuery("", "Squat"), true);
    assert.equal(exerciseMatchesQuery("squat", "Squat"), true);
    assert.equal(exerciseMatchesQuery("squat", "Pull-Up"), false);
});

check("starts-with ranks ahead of a looser token match", () => {
    const incline = scoreExerciseMatch("incline", "Incline Dumbbell Bench Press");
    const buried = scoreExerciseMatch("incline", "Barbell Bench Press");
    assert.ok(incline < 3);
    assert.ok(buried === 999 || incline < buried);
});

console.log(`\n${passed} checks passed`);
