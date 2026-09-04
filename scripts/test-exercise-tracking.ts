/**
 * Unit tests for exercise tracking schemas (no DB).
 * Run: npm run test:tracking
 */
import assert from "node:assert/strict";
import {
    coerceSetMetrics,
    evaluateMetricAwarePr,
    formatSetSummary,
    guessTrackingPreset,
    hasPerformedMetrics,
    isSchemaWorkingSet,
    normalizeTrackingSchema,
    schemaFromPreset,
    EMPTY_METRIC_RECORDS,
    cloneMetricRecords,
} from "../src/lib/exerciseTracking";

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

console.log("\nExercise tracking tests\n");

check("preset strength enables weight+reps", () => {
    const s = schemaFromPreset("strength");
    assert.equal(s.preset, "strength");
    assert.ok(s.fields.find((f) => f.key === "weight")?.enabled);
    assert.ok(s.fields.find((f) => f.key === "reps")?.enabled);
    assert.equal(s.fields.find((f) => f.key === "duration")?.enabled, false);
});

check("preset timed enables duration", () => {
    const s = schemaFromPreset("timed");
    assert.ok(s.fields.find((f) => f.key === "duration")?.enabled);
    assert.equal(s.fields.find((f) => f.key === "weight")?.enabled, false);
});

check("preset distance_time enables distance+duration+pace", () => {
    const s = schemaFromPreset("distance_time");
    assert.ok(s.fields.find((f) => f.key === "distance")?.enabled);
    assert.ok(s.fields.find((f) => f.key === "duration")?.enabled);
    assert.ok(s.fields.find((f) => f.key === "pace")?.enabled);
});

check("preset weight_distance enables weight+distance", () => {
    const s = schemaFromPreset("weight_distance");
    assert.ok(s.fields.find((f) => f.key === "weight")?.enabled);
    assert.ok(s.fields.find((f) => f.key === "distance")?.enabled);
});

check("preset height_reps enables height+reps", () => {
    const s = schemaFromPreset("height_reps");
    assert.ok(s.fields.find((f) => f.key === "height")?.enabled);
    assert.ok(s.fields.find((f) => f.key === "reps")?.enabled);
});

check("preset cardio enables duration+distance", () => {
    const s = schemaFromPreset("cardio");
    assert.ok(s.fields.find((f) => f.key === "duration")?.enabled);
    assert.ok(s.fields.find((f) => f.key === "distance")?.enabled);
    assert.equal(s.fields.find((f) => f.key === "weight")?.enabled, false);
});

check("guess Dead Hang → timed", () => {
    assert.equal(guessTrackingPreset("Dead Hang"), "timed");
});

check("guess Sprint → distance_time", () => {
    assert.equal(guessTrackingPreset("Sprint"), "distance_time");
});

check("guess Farmer's Carry → weight_distance", () => {
    assert.equal(guessTrackingPreset("Farmer's Carry"), "weight_distance");
});

check("guess Box Jump → height_reps", () => {
    assert.equal(guessTrackingPreset("Box Jump"), "height_reps");
});

check("guess Push-Up → reps_only", () => {
    assert.equal(guessTrackingPreset("Push-Up"), "reps_only");
});

check("guess Bench Press → strength", () => {
    assert.equal(guessTrackingPreset("Bench Press"), "strength");
});

check("hasPerformedMetrics strength with weight+reps", () => {
    const schema = schemaFromPreset("strength");
    assert.equal(
        hasPerformedMetrics(coerceSetMetrics({ weightKg: 100, reps: 5 }), schema),
        true
    );
    assert.equal(
        hasPerformedMetrics(coerceSetMetrics({ weightKg: 0, reps: 0 }), schema),
        false
    );
});

check("hasPerformedMetrics timed with duration only", () => {
    const schema = schemaFromPreset("timed");
    assert.equal(
        hasPerformedMetrics(coerceSetMetrics({ durationSec: 45 }), schema),
        true
    );
});

check("isSchemaWorkingSet requires required fields", () => {
    const schema = schemaFromPreset("strength");
    assert.equal(
        isSchemaWorkingSet(coerceSetMetrics({ weightKg: 100, reps: 0 }), schema),
        false
    );
    assert.equal(
        isSchemaWorkingSet(
            { ...coerceSetMetrics({ weightKg: 100, reps: 5 }), isWarmup: false },
            schema
        ),
        true
    );
    assert.equal(
        isSchemaWorkingSet(
            { ...coerceSetMetrics({ weightKg: 100, reps: 5 }), isWarmup: true },
            schema
        ),
        false
    );
});

check("formatSetSummary timed", () => {
    const schema = schemaFromPreset("timed");
    const line = formatSetSummary(coerceSetMetrics({ durationSec: 90 }), schema);
    assert.match(line, /1m/);
});

check("formatSetSummary strength", () => {
    const schema = schemaFromPreset("strength");
    const line = formatSetSummary(coerceSetMetrics({ weightKg: 100, reps: 8 }), schema);
    assert.match(line, /100/);
    assert.match(line, /8 reps/);
});

check("evaluateMetricAwarePr duration PR", () => {
    const schema = schemaFromPreset("timed");
    const board = cloneMetricRecords(EMPTY_METRIC_RECORDS);
    board.bestDurationSec = 60;
    const hit = evaluateMetricAwarePr(
        { ...coerceSetMetrics({ durationSec: 75 }), isWarmup: false },
        board,
        schema
    );
    assert.equal(hit.isPr, true);
    assert.equal(hit.kind, "duration");
    const miss = evaluateMetricAwarePr(
        { ...coerceSetMetrics({ durationSec: 50 }), isWarmup: false },
        board,
        schema
    );
    assert.equal(miss.isPr, false);
});

check("evaluateMetricAwarePr pace PR", () => {
    const schema = schemaFromPreset("distance_time");
    const board = cloneMetricRecords(EMPTY_METRIC_RECORDS);
    board.bestDistanceMeters = 400;
    board.bestTimeByDistance["400"] = 80;
    const hit = evaluateMetricAwarePr(
        {
            ...coerceSetMetrics({ distanceMeters: 400, durationSec: 70 }),
            isWarmup: false,
        },
        board,
        schema
    );
    assert.equal(hit.isPr, true);
    assert.ok(hit.kinds.includes("pace"));
});

check("normalizeTrackingSchema merges custom fields", () => {
    const normalized = normalizeTrackingSchema({
        preset: "custom",
        fields: [
            { key: "sets", enabled: true, required: true, planTarget: true },
            { key: "duration", enabled: true, required: true, planTarget: true },
            { key: "weight", enabled: false },
        ],
    });
    assert.equal(normalized.preset, "custom");
    assert.ok(normalized.fields.find((f) => f.key === "duration")?.enabled);
    assert.equal(normalized.fields.find((f) => f.key === "weight")?.enabled, false);
    // Full field list present
    assert.ok(normalized.fields.length >= 10);
    assert.ok(normalized.fields.find((f) => f.key === "sets")?.enabled);
});

console.log(`\n${passed} passed\n`);
