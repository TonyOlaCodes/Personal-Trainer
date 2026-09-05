import { exerciseIdentityKey } from "@/lib/exerciseIdentity";

export const EXERCISE_SEARCH_LIMIT = 20;

/** About five result rows visible before the list scrolls. */
export const EXERCISE_RESULTS_VISIBLE_MAX_CLASS = "max-h-56";

const NO_MATCH = 999;

/** Equipment shorthands users type in search boxes. */
const SEARCH_TOKEN_SYNONYMS: Record<string, string> = {
    db: "dumbbell",
    dbs: "dumbbell",
    bb: "barbell",
    kb: "kettlebell",
    kbs: "kettlebell",
};

/**
 * Safe text fold for matching. Fixed character classes only — never builds a
 * RegExp from the user's raw query.
 */
export function normalizeExerciseSearchText(value: string): string {
    return value
        .toLowerCase()
        .replace(/[’']/g, "")
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

export function tokenizeExerciseSearch(value: string): string[] {
    const normalized = normalizeExerciseSearchText(value);
    if (!normalized) return [];
    return normalized.split(" ").filter(Boolean).map((token) => SEARCH_TOKEN_SYNONYMS[token] ?? token);
}

function tokenAffinity(queryToken: string, nameToken: string): number | null {
    if (queryToken === nameToken) return 0;
    if (queryToken.length >= 2 && nameToken.startsWith(queryToken)) return 1;
    if (nameToken.length >= 2 && queryToken.startsWith(nameToken) && nameToken.length >= 3) return 2;
    if (queryToken.length >= 3 && nameToken.includes(queryToken)) return 3;
    if (nameToken.length >= 3 && queryToken.includes(nameToken)) return 4;
    return null;
}

function scoreTokenCoverage(queryTokens: string[], nameTokens: string[]): number | null {
    if (queryTokens.length === 0 || nameTokens.length === 0) return null;

    const used = new Set<number>();
    let total = 0;

    for (const qToken of queryTokens) {
        let best: number | null = null;
        let bestIndex = -1;
        for (let i = 0; i < nameTokens.length; i++) {
            if (used.has(i)) continue;
            const affinity = tokenAffinity(qToken, nameTokens[i]);
            if (affinity == null) continue;
            if (best == null || affinity < best) {
                best = affinity;
                bestIndex = i;
            }
        }
        if (best == null || bestIndex < 0) return null;
        used.add(bestIndex);
        total += best;
    }

    const strong = total <= queryTokens.length;
    return strong ? 3 + total * 0.1 : 4 + total * 0.1;
}

/**
 * Lower score = better match. 999 = no match.
 *
 * 0 exact name
 * 1 name starts with the search
 * 2 contiguous normalized phrase
 * 3–4 all search tokens match (order-independent)
 * 5 canonical identity / alias
 */
export function scoreExerciseMatch(query: string, name: string): number {
    const qNorm = normalizeExerciseSearchText(query);
    const nNorm = normalizeExerciseSearchText(name);
    if (!qNorm || !nNorm) return NO_MATCH;
    if (nNorm === qNorm) return 0;
    if (nNorm.startsWith(`${qNorm} `) || nNorm.startsWith(qNorm)) return 1;
    if (nNorm.includes(qNorm)) return 2;

    const qTokens = tokenizeExerciseSearch(query);
    const nTokens = tokenizeExerciseSearch(name);
    const tokenScore = scoreTokenCoverage(qTokens, nTokens);
    if (tokenScore != null) return tokenScore;

    const qKey = exerciseIdentityKey(query);
    const nKey = exerciseIdentityKey(name);
    if (qKey && nKey && qKey === nKey) return 5;

    if (qKey && nKey) {
        const qKeyTokens = qKey.split(" ").filter(Boolean);
        const nKeyTokens = nKey.split(" ").filter(Boolean);
        if (qKeyTokens.length > 0 && scoreTokenCoverage(qKeyTokens, nKeyTokens) != null) {
            return 5.5;
        }
    }

    return NO_MATCH;
}

function bestScoreForExercise(
    query: string,
    name: string,
    aliases: string[]
): number {
    let score = scoreExerciseMatch(query, name);
    for (const alias of aliases) {
        const aliasScore = scoreExerciseMatch(query, alias);
        if (aliasScore < NO_MATCH) {
            score = Math.min(score, aliasScore + 0.05);
        }
    }
    return score;
}

export function searchExercises<T extends { name: string }>(
    query: string,
    exercises: T[],
    limit = EXERCISE_SEARCH_LIMIT,
    options?: { aliases?: Array<{ alias: string; name: string }> }
): T[] {
    const q = query.trim();
    const cap = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : exercises.length;
    if (!normalizeExerciseSearchText(q)) {
        return exercises.slice(0, cap);
    }

    const aliasesByCanonical = new Map<string, string[]>();
    for (const row of options?.aliases ?? []) {
        const list = aliasesByCanonical.get(row.name) ?? [];
        list.push(row.alias);
        aliasesByCanonical.set(row.name, list);
    }

    return exercises
        .map((ex) => ({
            ex,
            score: bestScoreForExercise(q, ex.name, aliasesByCanonical.get(ex.name) ?? []),
        }))
        .filter((item) => item.score < NO_MATCH)
        .sort((a, b) => a.score - b.score || a.ex.name.length - b.ex.name.length || a.ex.name.localeCompare(b.ex.name))
        .slice(0, cap)
        .map((item) => item.ex);
}

/** Rank a list of exercise names with the same matcher used by the dictionary. */
export function searchExerciseNames(
    query: string,
    names: string[],
    limit = names.length
): string[] {
    return searchExercises(
        query,
        names.map((name) => ({ name })),
        limit
    ).map((item) => item.name);
}

export function exerciseMatchesQuery(query: string, name: string): boolean {
    if (!normalizeExerciseSearchText(query)) return true;
    return scoreExerciseMatch(query, name) < NO_MATCH;
}
