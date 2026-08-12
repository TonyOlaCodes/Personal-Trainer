/**
 * Report duplicate exercise names in the seed dictionary and (when a database is
 * reachable) in the live tables. Read-only — run before `merge:exercises`.
 *
 * Run: npm run audit:exercises
 */
import {
    findDuplicateExerciseGroups,
    getCanonicalDictionary,
    canonicalExerciseName,
} from "../src/lib/exerciseCanonical";
import { exerciseIdentityKey } from "../src/lib/exerciseIdentity";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EXERCISES } = require("./exerciseDictionary.js") as {
    EXERCISES: Array<{ name: string }>;
};

function reportGroups(label: string, names: string[]) {
    const groups = findDuplicateExerciseGroups(names);
    console.log(`\n${label}: ${names.length} names, ${groups.length} duplicate group(s)`);
    for (const group of groups) {
        console.log(`  ${group.canonicalName}  <-  ${group.duplicateNames.join(", ")}`);
    }
    return groups;
}

async function auditDatabase() {
    let prisma: import("@prisma/client").PrismaClient;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { PrismaClient } = require("@prisma/client");
        prisma = new PrismaClient();
    } catch {
        console.log("\nSkipping database audit (Prisma client unavailable).");
        return;
    }

    try {
        const [globals, planExercises, logSets] = await Promise.all([
            prisma.globalExercise.findMany({ select: { name: true } }),
            prisma.exercise.findMany({ select: { name: true } }),
            prisma.logSet.findMany({ select: { exerciseName: true }, distinct: ["exerciseName"] }),
        ]);

        reportGroups("global_exercises", globals.map((row) => row.name));
        reportGroups("plan exercises", [...new Set(planExercises.map((row) => row.name))]);
        reportGroups(
            "logged set names",
            [...new Set(logSets.map((row) => row.exerciseName).filter((name): name is string => Boolean(name)))]
        );

        const nonCanonical = [...new Set(planExercises.map((row) => row.name))].filter(
            (name) => canonicalExerciseName(name) !== name
        );
        if (nonCanonical.length > 0) {
            console.log(`\nPlan exercise names that would be renamed (${nonCanonical.length}):`);
            for (const name of nonCanonical.sort()) {
                console.log(`  ${name}  ->  ${canonicalExerciseName(name)}`);
            }
        }
    } catch (error) {
        console.log(`\nSkipping database audit (${error instanceof Error ? error.message : String(error)}).`);
    } finally {
        await prisma.$disconnect().catch(() => {});
    }
}

async function main() {
    const rawNames = EXERCISES.map((ex) => ex.name);
    const dictionaryGroups = reportGroups("seed dictionary (raw)", rawNames);

    const canonical = getCanonicalDictionary();
    const canonicalGroups = findDuplicateExerciseGroups(canonical.map((ex) => ex.name));
    console.log(`\nCanonical library: ${canonical.length} exercises, ${canonicalGroups.length} duplicate group(s)`);

    const collisions = new Map<string, string[]>();
    for (const entry of canonical) {
        const key = exerciseIdentityKey(entry.name);
        const bucket = collisions.get(key) ?? [];
        bucket.push(entry.name);
        collisions.set(key, bucket);
    }
    const colliding = [...collisions.entries()].filter(([, names]) => names.length > 1);

    if (canonicalGroups.length > 0 || colliding.length > 0) {
        console.error("\nCanonical library still contains duplicate identities:");
        for (const [key, names] of colliding) console.error(`  ${key}: ${names.join(", ")}`);
        process.exit(1);
    }

    console.log(
        `\nDictionary collapses ${rawNames.length} raw names into ${canonical.length} canonical exercises`
        + ` (${dictionaryGroups.length} duplicate group(s) resolved).`
    );

    await auditDatabase();
}

void main();
