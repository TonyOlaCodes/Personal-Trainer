/**
 * CI / pre-deploy guard: fail if known data-wipe patterns reappear.
 * Run: npm run audit:safety
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const API_DIR = path.join(ROOT, "src", "app", "api");
const LIB_FILES = [
    path.join(ROOT, "src", "lib", "planUpdate.ts"),
];

const FORBIDDEN_GLOBAL = [
    {
        id: "plan-week-deleteMany",
        pattern: /week\.deleteMany\s*\(\s*\{\s*where:\s*\{\s*planId/,
        hint: "Never delete all plan weeks on save — use updatePlanPreservingHistory in src/lib/planUpdate.ts",
    },
];

const FORBIDDEN_PLAN_PATCH = [
    {
        id: "plan-recreate-weeks-on-patch",
        pattern: /weeks:\s*\{\s*create:\s*weeks\.map/,
        hint: "Never replace entire plan tree on PATCH — use updatePlanPreservingHistory",
    },
];

const ALLOWED_WORKOUT_LOG_DELETE = new Set([
    path.normalize(path.join(API_DIR, "logs", "route.ts")),
]);

const FORBIDDEN_API = [
    {
        id: "workoutLog-deleteMany-unscoped",
        pattern: /workoutLog\.deleteMany/,
        allow: (file) => ALLOWED_WORKOUT_LOG_DELETE.has(path.normalize(file)),
        hint: "workoutLog.deleteMany is only allowed in logs/route.ts and must filter status: IN_PROGRESS",
    },
];

function walk(dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, files);
        else if (entry.name.endsWith(".ts")) files.push(full);
    }
    return files;
}

const violations = [];

function checkFile(file, rules) {
    const content = fs.readFileSync(file, "utf8");
    for (const rule of rules) {
        if (rule.allow?.(file)) continue;
        if (rule.pattern.test(content)) {
            violations.push({ file: path.relative(process.cwd(), file), ...rule });
        }
    }
}

for (const file of walk(API_DIR)) {
    checkFile(file, FORBIDDEN_GLOBAL);
    checkFile(file, FORBIDDEN_API);
    if (file.includes(`${path.sep}plans${path.sep}[planId]${path.sep}route.ts`)) {
        checkFile(file, FORBIDDEN_PLAN_PATCH);
    }
}

for (const file of LIB_FILES) {
    if (fs.existsSync(file)) checkFile(file, FORBIDDEN_GLOBAL);
}

if (violations.length > 0) {
    console.error("Data safety audit FAILED:\n");
    for (const v of violations) {
        console.error(`  [${v.id}] ${v.file}`);
        console.error(`    ${v.hint}\n`);
    }
    process.exit(1);
}

console.log("Data safety audit passed.");
