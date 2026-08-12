/**
 * CI guard: verify workout streak scenario expectations.
 * Run: npm run audit:streak
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const STREAK_FILE = path.join(ROOT, "src", "lib", "workoutAdherenceStreak.ts");

const REQUIRED_PATTERNS = [
    { id: "first-completion-anchor", pattern: /findFirstCompletedWorkoutDateKey/ },
    { id: "neutral-pre-start-days", pattern: /status:\s*"neutral"/ },
    { id: "pending-today-excluded", pattern: /streakDaysForEvaluation/ },
    { id: "excused-keeps-streak", pattern: /excusedKeys\.has\(slotKey\)/ },
    { id: "scenario-checks", pattern: /runStreakScenarioChecks/ },
];

const source = fs.readFileSync(STREAK_FILE, "utf8");
const missing = REQUIRED_PATTERNS.filter((rule) => !rule.pattern.test(source));

if (missing.length > 0) {
    console.error("Streak logic audit FAILED — missing patterns:\n");
    for (const rule of missing) {
        console.error(`  [${rule.id}]`);
    }
    process.exit(1);
}

const runner = spawnSync("npx tsx scripts/run-streak-scenarios.ts", {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    windowsHide: true,
});

if (runner.status !== 0) {
    if (runner.stdout) process.stdout.write(runner.stdout);
    if (runner.stderr) process.stderr.write(runner.stderr);
    if (!runner.stdout && !runner.stderr) {
        console.error("Failed to run streak scenario checks via npx tsx.");
    }
    process.exit(runner.status ?? 1);
}

if (runner.stdout) process.stdout.write(runner.stdout);
console.log("Streak logic audit passed.");
