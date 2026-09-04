import { runStreakScenarioChecks } from "../src/lib/workoutAdherenceStreak";

const failures = runStreakScenarioChecks();
if (failures.length > 0) {
    console.error("Streak scenario checks FAILED:\n");
    for (const failure of failures) {
        console.error(`  ${failure}`);
    }
    process.exit(1);
}

console.log("Streak scenario checks passed.");
