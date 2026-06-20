import "server-only";
import { prisma } from "@/lib/prisma";

export type DictionaryExercise = { name: string; muscleGroup: string };

// Single source: scripts/exerciseDictionary.js (also used by npm run seed:exercises)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EXERCISES } = require("../../scripts/exerciseDictionary.js") as {
    EXERCISES: DictionaryExercise[];
};

export function getDictionaryExercises(): DictionaryExercise[] {
    return EXERCISES;
}

let dictionarySynced = false;

/** Upsert any dictionary entries missing from global_exercises (runs once per server instance). */
export async function ensureExerciseDictionary(): Promise<void> {
    if (dictionarySynced) return;

    const dictionary = getDictionaryExercises();
    const existing = await prisma.globalExercise.findMany({ select: { name: true } });
    const existingNames = new Set(existing.map((row) => row.name));
    const missing = dictionary.filter((ex) => !existingNames.has(ex.name));

    if (missing.length > 0) {
        await prisma.globalExercise.createMany({
            data: missing.map((ex) => ({
                name: ex.name,
                muscleGroup: ex.muscleGroup,
                instructions: `Targets: ${ex.muscleGroup}`,
            })),
            skipDuplicates: true,
        });
        console.log(`[exerciseDictionary] Synced ${missing.length} missing exercises`);
    }

    dictionarySynced = true;
}

export function searchDictionary(
    query: string,
    exercises: DictionaryExercise[],
    limit = 12
): DictionaryExercise[] {
    const q = query.trim();
    if (!q) return exercises.slice(0, limit);

    const score = (name: string): number => {
        const t = name.toLowerCase();
        const lq = q.toLowerCase();
        if (t === lq) return 0;
        if (t.startsWith(lq)) return 1;
        if (t.includes(lq)) return 2;
        const qWords = lq.split(/\s+/).filter(Boolean);
        if (qWords.length > 1 && qWords.every((w) => t.includes(w))) return 3;
        return 999;
    };

    return exercises
        .map((ex) => ({ ...ex, score: score(ex.name) }))
        .filter((item) => item.score < 999)
        .sort((a, b) => a.score - b.score || a.name.length - b.name.length)
        .slice(0, limit)
        .map(({ name, muscleGroup }) => ({ name, muscleGroup }));
}
