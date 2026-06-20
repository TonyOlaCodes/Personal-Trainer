#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { EXERCISES } = require("./exerciseDictionary.js");

const BASE = "https://www.muscleandstrength.com";
const CACHE_DIR = path.join(__dirname, ".cache");
const INDEX_PATH = path.join(CACHE_DIR, "ms-exercise-index.json");
const MEDIA_CACHE_PATH = path.join(CACHE_DIR, "ms-slug-media.json");
const OUTPUT_PATH = path.join(__dirname, "exerciseMediaData.js");
const FETCH_DELAY_MS = 80;
const MATCH_THRESHOLD = 0.45;

const CATEGORIES = [
    "chest", "lats", "lower-back", "shoulders", "traps", "biceps", "triceps",
    "forearms", "quads", "hamstrings", "glutes", "calves", "abs", "obliques",
    "hip-flexors", "it-band", "palmar-fascia", "plantar-fascia",
    "compound", "isolation", "bodyweight", "kettle-bells",
];

const MANUAL_SLUGS = {
    "Bench Press": "barbell-bench-press",
    "Barbell Bench Press": "barbell-bench-press",
    "Lat Pulldown": "lat-pull-down",
    "Lat Pulldowns": "lat-pull-down",
    "Pull-Up": "chin-up",
    "Pull-Ups": "chin-up",
    "Weighted Pull-Up": "chin-up",
    "Chin-Up": "chin-up",
    "Chin-Ups": "chin-up",
    "Push-Up": "push-up",
    "Pushup": "push-up",
    "Pec Deck": "pec-dec",
    "Pec Deck Fly": "pec-dec",
    "Face Pull": "cable-face-pull",
    "Face Pulls": "cable-face-pull",
    "Romanian Deadlift": "stiff-leg-deadlift-aka-romanian-deadlift",
    "Barbell Romanian Deadlift": "stiff-leg-deadlift-aka-romanian-deadlift",
    "Stiff-Leg Deadlift": "stiff-leg-deadlift-aka-romanian-deadlift",
    "Stiff Leg Deadlift": "stiff-leg-deadlift-aka-romanian-deadlift",
    "Dumbbell Fly": "dumbbell-flys",
    "Flat Dumbbell Fly": "dumbbell-flys",
    "Chest Fly": "dumbbell-flys",
    "Dumbbell Chest Fly": "dumbbell-flys",
    "Deadlift": "deadlifts",
    "Barbell Deadlift": "deadlifts",
    "Conventional Deadlift": "deadlifts",
    "Dumbbell Pullover": "dumbbell-pullover",
    "Lat Pullover": "dumbbell-pullover",
    "Smith Machine Bench Press": "smith-machine-bench-press",
    "Smith Machine Incline Press": "incline-smith-machine-bench-press",
    "Seated Cable Row": "seated-row",
    "Seated Cable Rows": "seated-row",
    "Barbell Row": "bent-over-barbell-row",
    "Barbell Rows": "bent-over-barbell-row",
    "Bent Over Row": "bent-over-barbell-row",
    "Cable Crunch": "seated-cable-crunch",
    "Cable Crunches": "seated-cable-crunch",
};

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function normalizeName(value) {
    return value
        .toLowerCase()
        .replace(/\(aka[^)]*\)/gi, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function stripHtml(html) {
    return html.replace(/<br\s*\/?>/gi, " ").replace(/<\/li>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function extractInstructions(html) {
    const m = html.match(/field-name-body[\s\S]*?<div class="field-item[^"]*">([\s\S]*?)<\/div>\s*<\/div>/i);
    if (!m) return null;
    const text = stripHtml(m[1]);
    return text.length > 20 ? text.slice(0, 600) : null;
}

function extractYoutubeId(html) {
    return html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/)?.[1] ?? html.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/)?.[1] ?? null;
}

async function fetchText(url) {
    const res = await fetch(url, { headers: { "User-Agent": "pt-app-exercise-sync/1.0" } });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.text();
}

function parseCategoryHtml(html) {
    const entries = [];
    const pattern = /href="(\/exercises\/([a-z0-9-]+)\.html)"[^>]*>([^<]*)</gi;
    let match;
    while ((match = pattern.exec(html)) !== null) {
        const [, href, slug, rawName] = match;
        const name = rawName.trim();
        if (!slug || slug.length < 4 || name.toLowerCase() === "view exercise") continue;
        entries.push({
            slug,
            msName: name || slug.replace(/-/g, " "),
            normalized: normalizeName(name || slug),
            sourceUrl: `${BASE}${href}`,
        });
    }
    return entries;
}

async function buildIndex(force) {
    if (!force && fs.existsSync(INDEX_PATH)) return JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const bySlug = new Map();
    for (const category of CATEGORIES) {
        for (let page = 0; page < 30; page++) {
            const url = page === 0 ? `${BASE}/exercises/${category}` : `${BASE}/exercises/${category}?page=${page}`;
            try {
                const entries = parseCategoryHtml(await fetchText(url));
                let added = 0;
                for (const e of entries) {
                    if (!bySlug.has(e.slug)) { bySlug.set(e.slug, e); added++; }
                }
                if (added === 0) break;
                await sleep(FETCH_DELAY_MS);
            } catch { break; }
        }
    }
    const index = [...bySlug.values()];
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
    return index;
}

function matchScore(dictName, msName) {
    const a = normalizeName(dictName).split(" ").filter(Boolean);
    const b = normalizeName(msName).split(" ").filter(Boolean);
    if (a.length === 0 || b.length === 0) return 0;
    let hits = 0;
    for (const token of a) {
        if (b.some((t) => t === token || t.startsWith(token) || token.startsWith(t))) hits++;
    }
    const coverage = hits / a.length;
    const jaccard = hits / new Set([...a, ...b]).size;
    const exact = normalizeName(dictName) === normalizeName(msName) ? 1 : 0;
    const slugA = slugify(dictName);
    const slugB = slugify(msName);
    const slugBonus = slugA === slugB || slugA.includes(slugB) || slugB.includes(slugA) ? 0.15 : 0;
    return Math.max(exact, coverage * 0.7 + jaccard * 0.3 + slugBonus);
}

function findBestIndexMatch(name, index) {
    if (MANUAL_SLUGS[name]) {
        const manual = index.find((r) => r.slug === MANUAL_SLUGS[name]);
        if (manual) return manual;
    }
    const slug = slugify(name);
    const slugHit = index.find((r) => r.slug === slug);
    if (slugHit) return slugHit;

    let best = null;
    let bestScore = 0;
    for (const row of index) {
        const score = matchScore(name, row.msName);
        if (score > bestScore) {
            bestScore = score;
            best = row;
        }
    }
    return bestScore >= MATCH_THRESHOLD ? best : null;
}

async function loadSlugMedia(index, force) {
    if (!force && fs.existsSync(MEDIA_CACHE_PATH)) {
        const cached = JSON.parse(fs.readFileSync(MEDIA_CACHE_PATH, "utf8"));
        if (Object.keys(cached).length > 100) return cached;
    }

    const mediaBySlug = {};
    console.log(`Fetching media for ${index.length} M&S exercises...`);
    for (let i = 0; i < index.length; i++) {
        const row = index[i];
        if ((i + 1) % 50 === 0) process.stdout.write(`  ${i + 1}/${index.length}\n`);
        try {
            const html = await fetchText(row.sourceUrl);
            const youtubeId = extractYoutubeId(html);
            if (youtubeId) {
                mediaBySlug[row.slug] = {
                    videoUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
                    thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
                    sourceUrl: row.sourceUrl,
                    instructions: extractInstructions(html),
                };
            }
        } catch {
            // skip
        }
        await sleep(FETCH_DELAY_MS);
    }
    fs.writeFileSync(MEDIA_CACHE_PATH, JSON.stringify(mediaBySlug, null, 2));
    return mediaBySlug;
}

async function main() {
    const force = process.argv.includes("--reindex");
    const index = await buildIndex(force);
    console.log(`Index: ${index.length} exercises`);
    const slugMedia = await loadSlugMedia(index, force);

    const mediaByName = {};
    const unmatched = [];

    for (const ex of EXERCISES) {
        const hit = findBestIndexMatch(ex.name, index);
        if (!hit) {
            unmatched.push(ex.name);
            continue;
        }
        const media = slugMedia[hit.slug];
        if (!media) {
            unmatched.push(ex.name);
            continue;
        }
        mediaByName[ex.name] = {
            ...media,
            instructions: media.instructions || `Targets: ${ex.muscleGroup}`,
        };
    }

    // Propagate within same matched slug
    const slugToMedia = new Map();
    for (const ex of EXERCISES) {
        const m = mediaByName[ex.name];
        if (!m) continue;
        const slug = m.sourceUrl.split("/").pop()?.replace(".html", "");
        if (slug) slugToMedia.set(slug, m);
    }
    for (const ex of EXERCISES) {
        if (mediaByName[ex.name]) continue;
        const hit = findBestIndexMatch(ex.name, index);
        if (!hit) continue;
        const shared = slugToMedia.get(hit.slug);
        if (shared) {
            mediaByName[ex.name] = { ...shared, instructions: shared.instructions || `Targets: ${ex.muscleGroup}` };
        }
    }

    // Fallback: borrow video from the closest named exercise in the same muscle group
    const withMedia = EXERCISES.filter((ex) => mediaByName[ex.name]);
    for (const ex of EXERCISES) {
        if (mediaByName[ex.name]) continue;
        let best = null;
        let bestScore = 0;
        for (const donor of withMedia) {
            if (donor.muscleGroup !== ex.muscleGroup) continue;
            const score = matchScore(ex.name, donor.name);
            if (score > bestScore) {
                bestScore = score;
                best = donor;
            }
        }
        if (best && bestScore >= 0.38) {
            const shared = mediaByName[best.name];
            mediaByName[ex.name] = {
                ...shared,
                instructions: shared.instructions || `Targets: ${ex.muscleGroup}`,
            };
        }
    }

    // Last resort: closest global name match (skips cardio donors for non-cardio exercises)
    for (const ex of EXERCISES) {
        if (mediaByName[ex.name]) continue;
        if (ex.muscleGroup === "Cardio") continue;
        let best = null;
        let bestScore = 0;
        for (const donor of withMedia) {
            if (donor.muscleGroup === "Cardio") continue;
            const score = matchScore(ex.name, donor.name);
            if (score > bestScore) {
                bestScore = score;
                best = donor;
            }
        }
        if (best && bestScore >= 0.62) {
            const shared = mediaByName[best.name];
            mediaByName[ex.name] = {
                ...shared,
                instructions: shared.instructions || `Targets: ${ex.muscleGroup}`,
            };
        }
    }

    fs.writeFileSync(OUTPUT_PATH, `/** Auto-generated by scripts/generate-exercise-media.mjs */\nmodule.exports = ${JSON.stringify(mediaByName, null, 4)};\n`);
    console.log(`With video: ${Object.keys(mediaByName).length}/${EXERCISES.length}`);
    console.log(`Slug media with video: ${Object.keys(slugMedia).length}/${index.length}`);
    console.log(`Unmatched sample:`, unmatched.slice(0, 30).join(", "));
}

main().catch((e) => { console.error(e); process.exit(1); });
