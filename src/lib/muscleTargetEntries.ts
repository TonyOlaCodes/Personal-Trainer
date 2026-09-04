import type { MuscleRegion } from "@/lib/muscleRegions";
import { ALL_MUSCLE_REGIONS } from "@/lib/muscleRegions";
import {
    MUSCLE_CONTRIBUTION_LEVELS,
    type MuscleContributionLevel,
} from "@/lib/muscleContribution";

export interface MuscleTargetEntry {
    region: MuscleRegion;
    level: MuscleContributionLevel;
}

function isRegion(value: unknown): value is MuscleRegion {
    return typeof value === "string" && (ALL_MUSCLE_REGIONS as string[]).includes(value);
}

function isLevel(value: unknown): value is MuscleContributionLevel {
    return typeof value === "string" && (MUSCLE_CONTRIBUTION_LEVELS as readonly string[]).includes(value);
}

export function normalizeMuscleTargets(input: unknown): MuscleTargetEntry[] {
    if (!Array.isArray(input)) return [];
    const byRegion = new Map<MuscleRegion, MuscleContributionLevel>();
    for (const raw of input) {
        if (!raw || typeof raw !== "object") continue;
        const region = (raw as { region?: unknown }).region;
        const level = (raw as { level?: unknown }).level;
        if (!isRegion(region) || !isLevel(level)) continue;
        byRegion.set(region, level);
    }
    return ALL_MUSCLE_REGIONS.filter((r) => byRegion.has(r)).map((region) => ({
        region,
        level: byRegion.get(region)!,
    }));
}

export function parseMuscleTargetsJson(json: string | null | undefined): MuscleTargetEntry[] {
    if (!json?.trim()) return [];
    try {
        return normalizeMuscleTargets(JSON.parse(json));
    } catch {
        return [];
    }
}

export function serializeMuscleTargets(targets: MuscleTargetEntry[]): string {
    return JSON.stringify(normalizeMuscleTargets(targets));
}

/** Convert targeting rows into primary/secondary/minor region lists. */
export function targetsToHit(targets: MuscleTargetEntry[]): {
    primary: MuscleRegion[];
    secondary: MuscleRegion[];
    minor: MuscleRegion[];
} {
    const primary: MuscleRegion[] = [];
    const secondary: MuscleRegion[] = [];
    const minor: MuscleRegion[] = [];
    for (const t of normalizeMuscleTargets(targets)) {
        if (t.level === "primary") primary.push(t.region);
        else if (t.level === "secondary") secondary.push(t.region);
        else minor.push(t.region);
    }
    return { primary, secondary, minor };
}

export function hitToTargets(hit: {
    primary: MuscleRegion[];
    secondary: MuscleRegion[];
    minor?: MuscleRegion[];
}): MuscleTargetEntry[] {
    const out: MuscleTargetEntry[] = [];
    for (const region of hit.primary) out.push({ region, level: "primary" });
    for (const region of hit.secondary) {
        if (!hit.primary.includes(region)) out.push({ region, level: "secondary" });
    }
    for (const region of hit.minor ?? []) {
        if (!hit.primary.includes(region) && !hit.secondary.includes(region)) {
            out.push({ region, level: "minor" });
        }
    }
    return normalizeMuscleTargets(out);
}
