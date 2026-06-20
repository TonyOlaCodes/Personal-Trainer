import "server-only";
import { prisma } from "@/lib/prisma";
import { EXERCISE_SEARCH_LIMIT, searchExercises } from "@/lib/exerciseSearch";

export type DictionaryExercise = {
    name: string;
    muscleGroup: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    sourceUrl?: string;
    instructions?: string;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EXERCISES } = require("../../scripts/exerciseDictionary.js") as {
    EXERCISES: DictionaryExercise[];
};

export function getDictionaryExercises(): DictionaryExercise[] {
    return EXERCISES;
}

let dictionarySynced = false;

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
                videoUrl: ex.videoUrl ?? null,
                instructions: ex.instructions ?? `Targets: ${ex.muscleGroup}`,
                thumbnailUrl: ex.thumbnailUrl ?? null,
            })),
            skipDuplicates: true,
        });
        console.log(`[exerciseDictionary] Synced ${missing.length} missing exercises`);
    }

    const withMedia = dictionary.filter((ex) => ex.videoUrl);
    for (const ex of withMedia) {
        await prisma.globalExercise.updateMany({
            where: { name: ex.name },
            data: {
                videoUrl: ex.videoUrl!,
                ...(ex.instructions ? { instructions: ex.instructions } : {}),
                ...(ex.thumbnailUrl ? { thumbnailUrl: ex.thumbnailUrl } : {}),
            },
        });
    }

    dictionarySynced = true;
}

export function searchDictionary(
    query: string,
    exercises: DictionaryExercise[],
    limit = EXERCISE_SEARCH_LIMIT
): DictionaryExercise[] {
    return searchExercises(query, exercises, limit);
}
