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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chestSearchAliasRows } = require("../../scripts/catalog/chest.js") as {
    chestSearchAliasRows: () => Array<{ alias: string; name: string; muscleGroup: string }>;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { backSearchAliasRows } = require("../../scripts/catalog/back.js") as {
    backSearchAliasRows: () => Array<{ alias: string; name: string; muscleGroup: string }>;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { shouldersSearchAliasRows } = require("../../scripts/catalog/shoulders.js") as {
    shouldersSearchAliasRows: () => Array<{ alias: string; name: string; muscleGroup: string }>;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { bicepsSearchAliasRows } = require("../../scripts/catalog/biceps.js") as {
    bicepsSearchAliasRows: () => Array<{ alias: string; name: string; muscleGroup: string }>;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { tricepsSearchAliasRows } = require("../../scripts/catalog/triceps.js") as {
    tricepsSearchAliasRows: () => Array<{ alias: string; name: string; muscleGroup: string }>;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { forearmsSearchAliasRows } = require("../../scripts/catalog/forearms.js") as {
    forearmsSearchAliasRows: () => Array<{ alias: string; name: string; muscleGroup: string }>;
};

export function getDictionaryExercises(): DictionaryExercise[] {
    return EXERCISES;
}

/** Search aliases that resolve to a canonical catalog name. */
export function getDictionarySearchAliases(): Array<{ alias: string; name: string }> {
    return [
        ...chestSearchAliasRows(),
        ...backSearchAliasRows(),
        ...shouldersSearchAliasRows(),
        ...bicepsSearchAliasRows(),
        ...tricepsSearchAliasRows(),
        ...forearmsSearchAliasRows(),
    ].map((row) => ({ alias: row.alias, name: row.name }));
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
    return searchExercises(query, exercises, limit, { aliases: getDictionarySearchAliases() });
}
