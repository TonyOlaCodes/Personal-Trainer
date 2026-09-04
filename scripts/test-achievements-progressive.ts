/**
 * Boundary tests for progressive achievements (no DB).
 * Run: npm run test:achievements
 */
import assert from "node:assert/strict";
import { formatStreakDisplay } from "../src/lib/achievements/rarity";
import type { AchievementRarity } from "../src/lib/achievements/rarity";
import { getProgressiveByKey, rarityForValue } from "../src/lib/achievements/progressiveCatalog";
import { rarityForCompleteAthlete } from "../src/lib/achievements/engine";

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

console.log("\nProgressive achievement tests\n");

const warrior = getProgressiveByKey("workout-warrior");
assert.ok(warrior, "workout-warrior definition exists");

check("Workout Warrior 9 → locked (null)", () => {
    assert.equal(rarityForValue(warrior!, 9), null);
});

check("Workout Warrior 10 → common", () => {
    assert.equal(rarityForValue(warrior!, 10), "common");
});

check("Workout Warrior 50 → uncommon", () => {
    assert.equal(rarityForValue(warrior!, 50), "uncommon");
});

check("Workout Warrior 100 → rare", () => {
    assert.equal(rarityForValue(warrior!, 100), "rare");
});

check("Workout Warrior 200 → epic", () => {
    assert.equal(rarityForValue(warrior!, 200), "epic");
});

check("Workout Warrior 400 → legendary", () => {
    assert.equal(rarityForValue(warrior!, 400), "legendary");
});

check("streak display equal → single mode", () => {
    const d = formatStreakDisplay(14, 14);
    assert.equal(d.mode, "single");
    if (d.mode === "single") assert.equal(d.days, 14);
});

check("streak display differ → dual mode", () => {
    const d = formatStreakDisplay(7, 30);
    assert.equal(d.mode, "dual");
    if (d.mode === "dual") {
        assert.equal(d.current, 7);
        assert.equal(d.best, 30);
    }
});

check("Complete Athlete common needs 3 at common+", () => {
    const families: AchievementRarity[] = ["common", "common", "uncommon"];
    assert.equal(rarityForCompleteAthlete(families), "common");
});

check("Complete Athlete uncommon needs 5 at uncommon+", () => {
    const families: AchievementRarity[] = [
        "uncommon",
        "uncommon",
        "rare",
        "epic",
        "common",
    ];
    // only 4 at uncommon+ → common only (3 at common+)
    assert.equal(rarityForCompleteAthlete(families), "common");

    const five: AchievementRarity[] = [
        "uncommon",
        "uncommon",
        "rare",
        "epic",
        "legendary",
    ];
    assert.equal(rarityForCompleteAthlete(five), "uncommon");
});

check("Complete Athlete legendary needs 12 epic+ AND 3 legendary", () => {
    const twelveEpic: AchievementRarity[] = Array(12).fill("epic") as AchievementRarity[];
    assert.notEqual(rarityForCompleteAthlete(twelveEpic), "legendary");
    assert.equal(rarityForCompleteAthlete(twelveEpic), "epic");

    const withLegendaries: AchievementRarity[] = [
        ...Array(9).fill("epic"),
        "legendary",
        "legendary",
        "legendary",
    ] as AchievementRarity[];
    assert.equal(withLegendaries.length, 12);
    assert.equal(rarityForCompleteAthlete(withLegendaries), "legendary");
});

console.log(`\n${passed} checks passed\n`);
process.exit(0);
