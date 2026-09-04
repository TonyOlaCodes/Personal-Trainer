/**
 * Unit tests for muscle contribution scoring (no DB).
 * Run: npm run test:muscles
 */
import assert from "node:assert/strict";
import {
    buildWorkoutMuscleBreakdown,
    musclesForExercise,
} from "../src/lib/exerciseMuscles";
import { heatFromContribution } from "../src/lib/muscleContribution";
import type { MuscleTargetEntry } from "../src/lib/muscleTargetEntries";

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

console.log("\nMuscle contribution tests\n");

check("workout muscle chips ordered by contribution score", () => {
    const breakdown = buildWorkoutMuscleBreakdown([
        { name: "Barbell Bench Press", muscleGroup: "Chest", sets: 4 },
        { name: "Incline Dumbbell Bench Press", muscleGroup: "Chest", sets: 3 },
        { name: "Tricep Pushdown", muscleGroup: "Triceps", sets: 3 },
        { name: "Dumbbell Lateral Raise", muscleGroup: "Shoulders", sets: 2 },
    ]);
    assert.ok(breakdown.primary.length >= 2);
    // Hottest primary should be chest from the pressing volume
    assert.equal(breakdown.primary[0], "chest");
    const chestScore = breakdown.intensity.chest ?? 0;
    const trisScore = breakdown.intensity.triceps ?? 0;
    assert.ok(chestScore >= trisScore);
});

check("RDL prioritises hamstrings over lower back", () => {
    const hit = musclesForExercise("Romanian Deadlift", "Hamstrings");
    assert.deepEqual(hit.primary, ["hamstrings"]);
    assert.ok(hit.secondary.includes("glutes"));
    assert.ok(hit.minor.includes("lowerBack"));
});


check("adding leg press increases quads", () => {
    const benchOnly = buildWorkoutMuscleBreakdown([
        { name: "Barbell Bench Press", muscleGroup: "Chest", sets: 3 },
    ]);
    const withLegs = buildWorkoutMuscleBreakdown([
        { name: "Barbell Bench Press", muscleGroup: "Chest", sets: 3 },
        { name: "Leg Press", muscleGroup: "Quads", sets: 3 },
    ]);
    assert.equal(benchOnly.intensity.quads ?? 0, 0);
    assert.ok((withLegs.intensity.quads ?? 0) > 0);
    assert.ok(withLegs.primary.includes("quads") || withLegs.secondary.includes("quads"));
});

check("more sets → higher relative score when alone", () => {
    const light = buildWorkoutMuscleBreakdown([
        { name: "Barbell Bench Press", sets: 1 },
    ]);
    const heavy = buildWorkoutMuscleBreakdown([
        { name: "Barbell Bench Press", sets: 8 },
    ]);
    // Alone, intensity still normalises to 1 for the hottest muscle
    assert.equal(light.intensity.chest, 1);
    assert.equal(heavy.intensity.chest, 1);
    // Heat band rises with absolute score
    const heatOrder = ["none", "veryLow", "low", "moderate", "high", "veryHigh"] as const;
    assert.ok(
        heatOrder.indexOf(heavy.heat.chest!) >= heatOrder.indexOf(light.heat.chest!),
        `expected heavy heat >= light: ${heavy.heat.chest} vs ${light.heat.chest}`
    );
});

check("more sets raise score vs a fixed companion", () => {
    const companion = { name: "Barbell Curl", sets: 3 };
    const withFew = buildWorkoutMuscleBreakdown([
        companion,
        { name: "Barbell Bench Press", sets: 1 },
    ]);
    const withMany = buildWorkoutMuscleBreakdown([
        companion,
        { name: "Barbell Bench Press", sets: 10 },
    ]);
    assert.ok((withMany.intensity.chest ?? 0) > (withFew.intensity.chest ?? 0));
});

check("heat levels progression from contribution helper", () => {
    assert.equal(heatFromContribution(0, 10), "none");
    assert.equal(heatFromContribution(0.2, 10), "veryLow");
    assert.ok(["low", "moderate", "high", "veryHigh"].includes(heatFromContribution(1.5, 10)));
    assert.ok(["moderate", "high", "veryHigh"].includes(heatFromContribution(3, 10)));
    assert.ok(["high", "veryHigh"].includes(heatFromContribution(5, 10)));
    assert.equal(heatFromContribution(8, 10), "veryHigh");
});

check("dictionary targets override heuristics", () => {
    const heuristic = musclesForExercise("Barbell Bench Press", "Chest");
    assert.ok(heuristic.primary.includes("chest"));

    const dictionary: MuscleTargetEntry[] = [
        { region: "quads", level: "primary" },
        { region: "glutes", level: "secondary" },
    ];
    const overridden = musclesForExercise("Barbell Bench Press", "Chest", dictionary);
    assert.deepEqual(overridden.primary, ["quads"]);
    assert.deepEqual(overridden.secondary, ["glutes"]);
    assert.ok(!overridden.primary.includes("chest"));

    const breakdown = buildWorkoutMuscleBreakdown([
        {
            name: "Barbell Bench Press",
            muscleGroup: "Chest",
            sets: 3,
            muscleTargets: dictionary,
        },
    ]);
    assert.ok(breakdown.primary.includes("quads"));
    assert.ok(!breakdown.primary.includes("chest"));
});

console.log(`\n${passed} passed\n`);
