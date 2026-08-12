/**
 * Canonical exercise display names, derived from the seed dictionary.
 *
 * `exerciseIdentity.ts` decides *whether* two names are the same movement; this
 * module decides *which spelling wins*. Import from server components, API routes
 * and scripts only — it pulls in the full seed dictionary.
 */

import { exerciseIdentityKey, titleCaseExerciseName } from "@/lib/exerciseIdentity";

type DictionaryEntry = { name: string; muscleGroup: string };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EXERCISES } = require("../../scripts/exerciseDictionary.js") as {
    EXERCISES: DictionaryEntry[];
};

/**
 * Spellings the dictionary order would otherwise pick that we want to override.
 * Keyed by identity key.
 */
const CANONICAL_NAME_OVERRIDES: Record<string, string> = {
    "farmer carry": "Farmer's Carry",
    "dumbbell chest fly": "Dumbbell Chest Fly",
    "jog": "Jogging",
};

/**
 * Qualifiers that change the movement. Two names may only be treated as the same
 * exercise when they agree on every one of these, which keeps unilateral variants
 * such as "Single Arm Tricep Pushdown" separate from "Tricep Pushdown".
 */
const DISTINGUISHING_QUALIFIERS = [
    "single arm",
    "single leg",
    "alternating",
    "assisted",
    "weighted",
    "negative",
    "isometric",
    "banded",
    "deficit",
    "paused",
    "tempo",
];

/**
 * True when merging `from` into `into` would erase a qualifier that changes the
 * movement. The merge tooling refuses those pairs.
 */
export function mergeWouldLoseDistinction(from: string, into: string): boolean {
    const a = exerciseIdentityKey(from);
    const b = exerciseIdentityKey(into);
    return DISTINGUISHING_QUALIFIERS.some(
        (qualifier) => a.includes(qualifier) !== b.includes(qualifier)
    );
}

let canonicalByKey: Map<string, string> | null = null;
let muscleGroupByKey: Map<string, string> | null = null;

function buildMaps() {
    if (canonicalByKey && muscleGroupByKey) return;

    const names = new Map<string, string>();
    const muscles = new Map<string, string>();

    for (const entry of EXERCISES) {
        const key = exerciseIdentityKey(entry.name);
        if (!key) continue;
        // First dictionary occurrence wins: the curated file lists the preferred
        // spelling (e.g. "Sit-Up") before the variant ("Sit Up").
        if (!names.has(key)) names.set(key, entry.name);
        if (!muscles.has(key) && entry.muscleGroup) muscles.set(key, entry.muscleGroup);
    }

    for (const [key, override] of Object.entries(CANONICAL_NAME_OVERRIDES)) {
        names.set(key, override);
    }

    canonicalByKey = names;
    muscleGroupByKey = muscles;
}

/**
 * The canonical spelling for a movement. Dictionary entries win; unknown custom
 * exercises keep the user's own wording (trimmed) so nothing is renamed blindly.
 */
export function canonicalExerciseName(name: string | null | undefined): string {
    const trimmed = (name ?? "").trim();
    if (!trimmed) return "";

    buildMaps();
    const key = exerciseIdentityKey(trimmed);
    if (!key) return trimmed;

    const canonical = canonicalByKey!.get(key);
    if (!canonical) return trimmed;
    if (mergeWouldLoseDistinction(trimmed, canonical)) return trimmed;
    return canonical;
}

/** Muscle group from exercise metadata, or null when the library has none. */
export function canonicalMuscleGroup(name: string | null | undefined): string | null {
    const trimmed = (name ?? "").trim();
    if (!trimmed) return null;
    buildMaps();
    const key = exerciseIdentityKey(trimmed);
    if (!key) return null;
    return muscleGroupByKey!.get(key) ?? null;
}

/** True when the name maps onto a library exercise rather than a one-off custom entry. */
export function isKnownExercise(name: string | null | undefined): boolean {
    const trimmed = (name ?? "").trim();
    if (!trimmed) return false;
    buildMaps();
    const key = exerciseIdentityKey(trimmed);
    return Boolean(key) && canonicalByKey!.has(key);
}

export interface CanonicalDictionaryEntry {
    name: string;
    muscleGroup: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    sourceUrl?: string;
    instructions?: string;
}

let canonicalDictionary: CanonicalDictionaryEntry[] | null = null;

/**
 * The seeded library with duplicate spellings collapsed onto one canonical entry.
 * Media from a dropped variant is carried over so nothing is lost.
 */
export function getCanonicalDictionary(): CanonicalDictionaryEntry[] {
    if (canonicalDictionary) return canonicalDictionary;
    buildMaps();

    const byKey = new Map<string, CanonicalDictionaryEntry>();

    for (const entry of EXERCISES as CanonicalDictionaryEntry[]) {
        const key = exerciseIdentityKey(entry.name);
        if (!key) continue;

        const existing = byKey.get(key);
        if (!existing) {
            byKey.set(key, { ...entry, name: canonicalByKey!.get(key) ?? entry.name });
            continue;
        }

        byKey.set(key, {
            ...existing,
            videoUrl: existing.videoUrl ?? entry.videoUrl,
            thumbnailUrl: existing.thumbnailUrl ?? entry.thumbnailUrl,
            sourceUrl: existing.sourceUrl ?? entry.sourceUrl,
            instructions: existing.instructions ?? entry.instructions,
            muscleGroup: existing.muscleGroup || entry.muscleGroup,
        });
    }

    canonicalDictionary = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
    return canonicalDictionary;
}

export interface DuplicateExerciseGroup {
    identityKey: string;
    canonicalName: string;
    duplicateNames: string[];
}

/**
 * Names that resolve to the same movement but are stored differently.
 * Used by the duplicate audit and the data migration.
 */
export function findDuplicateExerciseGroups(names: string[]): DuplicateExerciseGroup[] {
    buildMaps();

    const byKey = new Map<string, Set<string>>();
    for (const raw of names) {
        const name = (raw ?? "").trim();
        if (!name) continue;
        const key = exerciseIdentityKey(name);
        if (!key) continue;
        const bucket = byKey.get(key);
        if (bucket) bucket.add(name);
        else byKey.set(key, new Set([name]));
    }

    const groups: DuplicateExerciseGroup[] = [];
    for (const [key, variants] of byKey) {
        const canonical =
            canonicalByKey!.get(key)
            ?? pickFallbackCanonical([...variants]);
        const duplicates = [...variants]
            .filter((name) => name !== canonical && !mergeWouldLoseDistinction(name, canonical))
            .sort();
        if (duplicates.length === 0) continue;
        groups.push({ identityKey: key, canonicalName: canonical, duplicateNames: duplicates });
    }

    return groups.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
}

/**
 * Preferred spelling among custom names that share an identity: singular wins,
 * then the shortest, then alphabetical — deterministic so reruns agree.
 */
function pickFallbackCanonical(variants: string[]): string {
    return variants
        .slice()
        .sort((a, b) => {
            const pluralA = /s$/i.test(a) ? 1 : 0;
            const pluralB = /s$/i.test(b) ? 1 : 0;
            if (pluralA !== pluralB) return pluralA - pluralB;
            if (a.length !== b.length) return a.length - b.length;
            return a.localeCompare(b);
        })[0];
}

/** Canonical name for a raw name, falling back to a tidied title case. */
export function canonicalOrTitleCase(name: string | null | undefined): string {
    const canonical = canonicalExerciseName(name);
    if (!canonical) return "";
    if (isKnownExercise(canonical)) return canonical;
    return titleCaseExerciseName(canonical);
}
