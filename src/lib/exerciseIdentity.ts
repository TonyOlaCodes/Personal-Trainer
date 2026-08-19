/**
 * Canonical exercise identity — one movement, one identity, everywhere.
 *
 * Two names refer to the same movement when they produce the same identity key.
 * History, PRs, progression charts and previous-session lookups must all match on
 * the identity key rather than the raw stored name, so plural/spelling variants
 * ("Pull Ups" vs "Pull-Up") share a single continuous history.
 *
 * Isomorphic and dependency-free aside from catalog alias maps: safe to import
 * from client components, server routes and scripts. Display-name resolution
 * against the seed dictionary lives in `exerciseCanonical.ts` (server only).
 */

import { BACK_KEY_ALIASES } from "@/lib/catalog/backKeyAliases";
import { CHEST_KEY_ALIASES } from "@/lib/catalog/chestKeyAliases";
import { SHOULDERS_KEY_ALIASES } from "@/lib/catalog/shouldersKeyAliases";

/** Tokens written as one word in some places and two in others. */
const COMPOUND_TOKEN_SPLITS: Record<string, string> = {
    pushup: "push up",
    pullup: "pull up",
    chinup: "chin up",
    situp: "sit up",
    stepup: "step up",
    stepover: "step over",
    stepdown: "step down",
    muscleup: "muscle up",
    signup: "sign up",
    vup: "v up",
    lsit: "l sit",
    singlearm: "single arm",
    onearm: "single arm",
    singleleg: "single leg",
    oneleg: "single leg",
    deadhang: "dead hang",
    kneeup: "knee up",
    legraise: "leg raise",
    wallball: "wall ball",
    ghd: "ghd",
};

/** Equipment and phrasing shorthands that mean exactly the same movement. */
const TOKEN_SYNONYMS: Record<string, string> = {
    db: "dumbbell",
    dbs: "dumbbell",
    bb: "barbell",
    kb: "kettlebell",
    kbs: "kettlebell",
    ez: "ez",
    "1": "single",
    grip: "grip",
    wt: "weighted",
    bw: "bodyweight",
};

/**
 * Whole-phrase equivalences applied after tokenisation, mapping a variant key to
 * the canonical key. Only genuinely identical movements belong here — never merge
 * unilateral variants (Single Arm Row) into their bilateral counterparts.
 */
const KEY_ALIASES: Record<string, string> = {
    // Cardio equipment synonyms
    "rower": "rowing machine",
    "cross trainer": "elliptical",
    "air bike": "assault bike",
    "walking": "walk",
    "jogging": "jog",
    "running": "run",
    "swimming": "swim",
    "skipping": "jump rope",
    "skip rope": "jump rope",

    // Naming variants for the same lift (non-chest leftovers)
    "nordic hamstring curl": "nordic curl",
    "farmer walk": "farmer carry",
    "ghd hamstring curl": "glute ham raise",
    "barbell bicep curl": "barbell curl",
    "cable bicep curl": "cable curl",
    // ohp / overhead press resolved via SHOULDERS_KEY_ALIASES → barbell overhead press

    // Catalog aliases — keep in sync with scripts/catalog/*
    ...CHEST_KEY_ALIASES,
    ...BACK_KEY_ALIASES,
    ...SHOULDERS_KEY_ALIASES,
};

/** Ambiguous plurals where dropping the trailing "s" would change the movement. */
const PRESERVE_TOKENS = new Set(["press", "cross", "bus", "gas", "swiss", "chess"]);

const IRREGULAR_SINGULARS: Record<string, string> = {
    calves: "calf",
    knees: "knee",
    flies: "fly",
    flys: "fly",
    lunges: "lunge",
    crunches: "crunch",
    thrusters: "thruster",
    burpees: "burpee",
    presses: "press",
    benches: "bench",
    pushes: "push",
    boxes: "box",
};

function singulariseToken(token: string): string {
    if (IRREGULAR_SINGULARS[token]) return IRREGULAR_SINGULARS[token];
    if (PRESERVE_TOKENS.has(token)) return token;
    if (token.length <= 2) return token;
    if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
    if (/(sses|shes|ches|xes|zes)$/.test(token)) return token.slice(0, -2);
    if (token.endsWith("ss")) return token;
    if (token.endsWith("s")) return token.slice(0, -1);
    return token;
}

function baseIdentityKey(name: string): string {
    const cleaned = name
        .toLowerCase()
        .replace(/[’']/g, "")
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    if (!cleaned) return "";

    const tokens: string[] = [];
    for (const raw of cleaned.split(" ")) {
        const singular = singulariseToken(raw);
        const synonym = TOKEN_SYNONYMS[singular] ?? singular;
        const split = COMPOUND_TOKEN_SPLITS[synonym] ?? synonym;
        for (const part of split.split(" ")) {
            if (part) tokens.push(part);
        }
    }

    return tokens.join(" ");
}

/**
 * Stable identity for a movement. Equal keys mean the same exercise for history,
 * PRs and previous-session comparison; empty string when the name is unusable.
 */
export function exerciseIdentityKey(name: string | null | undefined): string {
    if (!name) return "";
    const base = baseIdentityKey(name);
    if (!base) return "";
    return KEY_ALIASES[base] ?? base;
}

/** True when both names describe the same movement. */
export function isSameExercise(a: string | null | undefined, b: string | null | undefined): boolean {
    const keyA = exerciseIdentityKey(a);
    if (!keyA) return false;
    return keyA === exerciseIdentityKey(b);
}

/**
 * Title-cases an identity key as a readable fallback for names that are not in the
 * seed dictionary. Server code should prefer `canonicalExerciseName` so dictionary
 * casing and hyphenation win.
 */
export function titleCaseExerciseName(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .map((word) => (word.length === 0 ? word : word[0].toUpperCase() + word.slice(1)))
        .join(" ");
}

/** Groups values by exercise identity, keeping first-seen order. */
export function groupByExerciseIdentity<T>(
    items: T[],
    getName: (item: T) => string | null | undefined
): Map<string, T[]> {
    const grouped = new Map<string, T[]>();
    for (const item of items) {
        const key = exerciseIdentityKey(getName(item));
        if (!key) continue;
        const existing = grouped.get(key);
        if (existing) {
            existing.push(item);
        } else {
            grouped.set(key, [item]);
        }
    }
    return grouped;
}
