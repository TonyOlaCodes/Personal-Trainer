export const EXERCISE_SEARCH_LIMIT = 5;

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function levenshtein(a: string, b: string): number {
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = i;
        for (let j = 1; j <= b.length; j++) {
            const val =
                a[i - 1] === b[j - 1]
                    ? row[j - 1]
                    : Math.min(row[j - 1], prev, row[j]) + 1;
            row[j - 1] = prev;
            prev = val;
        }
        row[b.length] = prev;
    }
    return row[b.length];
}

/** Regex with .* between query chars — "latpull" matches "Lat Pullover". */
function buildCharGapPattern(query: string): RegExp | null {
    const compact = query.replace(/\s+/g, "");
    if (!compact) return null;
    return new RegExp(compact.split("").map(escapeRegex).join(".*"), "i");
}

/** Words in order with flexible gaps — "lat pull" matches "Cable Lat Pullover". */
function buildOrderedWordPattern(words: string[]): RegExp | null {
    if (!words.length) return null;
    return new RegExp(words.map(escapeRegex).join(".*"), "i");
}

/** Lower score = better match. 999 = no match. */
export function scoreExerciseMatch(query: string, name: string): number {
    const q = query.trim().toLowerCase();
    const n = name.toLowerCase();
    if (!q) return 999;
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.includes(q)) return 2;

    const words = q.split(/\s+/).filter(Boolean);
    const nameWords = n.split(/[\s\-()/]+/).filter(Boolean);

    if (words.length > 1 && words.every((w) => n.includes(w))) {
        return 3 + words.length * 0.1;
    }

    const ordered = buildOrderedWordPattern(words);
    if (ordered?.test(n)) return 5 + q.length * 0.01;

    if (words.length === 1) {
        const w = words[0];
        for (const nw of nameWords) {
            if (nw === w) return 4;
            if (nw.startsWith(w)) return 6;
            if (w.length >= 3 && nw.includes(w)) return 7;
            const dist = levenshtein(w, nw);
            if (dist <= 2 && w.length >= 4) return 12 + dist;
        }
    }

    if (words.length > 0) {
        let total = 0;
        let allMatched = true;
        for (const w of words) {
            let best = Infinity;
            for (const nw of nameWords) {
                if (nw.includes(w)) best = Math.min(best, 0);
                else if (nw.startsWith(w)) best = Math.min(best, 1);
                else best = Math.min(best, levenshtein(w, nw));
            }
            if (best > 3) {
                allMatched = false;
                break;
            }
            total += best;
        }
        if (allMatched) return 15 + total;
    }

    const gap = buildCharGapPattern(q);
    const compactName = n.replace(/[\s\-()/]/g, "");
    if (gap?.test(compactName)) return 25 + q.length * 0.1;

    return 999;
}

export function searchExercises<T extends { name: string }>(
    query: string,
    exercises: T[],
    limit = EXERCISE_SEARCH_LIMIT
): T[] {
    const q = query.trim();
    if (!q) return exercises.slice(0, limit);

    return exercises
        .map((ex) => ({ ex, score: scoreExerciseMatch(q, ex.name) }))
        .filter((item) => item.score < 999)
        .sort((a, b) => a.score - b.score || a.ex.name.length - b.ex.name.length)
        .slice(0, limit)
        .map((item) => item.ex);
}
