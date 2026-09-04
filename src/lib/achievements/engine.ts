import { randomUUID } from "crypto";
import { createNotification, ensureNotificationsTable } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/lib/notificationTypes";
import { prisma } from "@/lib/prisma";
import {
    ACHIEVEMENT_RARITIES,
    highestRarity,
    nextRarity,
    RARITY_RANK,
    RARITY_TOKENS,
    type AchievementRarity,
} from "./rarity";
import { LEGACY_TO_PROGRESSIVE, LEGACY_TO_SPECIAL } from "./legacyMap";
import {
    PROGRESSIVE_ACHIEVEMENTS,
    getProgressiveByKey,
    rarityForValue,
    tierRequirement,
} from "./progressiveCatalog";
import {
    getProgressiveAchievementStats,
    type ProgressiveAchievementStats,
} from "./progressiveStats";
import { SPECIAL_ACHIEVEMENTS, getSpecialByKey } from "./specialCatalog";
import type { AchievementEventType, AchievementIcon, ProgressiveMetricKey } from "./types";

export interface ProgressiveDisplayItem {
    id: string;
    title: string;
    description: string;
    unlockHint: string;
    rarity: AchievementRarity;
    icon: AchievementIcon;
    unlocked: boolean;
    unlockedAt: string | null;
    progress: { current: number; target: number } | null;
    kind: "progressive" | "special";
    category: string;
    highestRarity: AchievementRarity | null;
    nextRarity: AchievementRarity | null;
    metricValue: number;
    unit: string;
    tierHistory: Array<{
        rarity: AchievementRarity;
        requirement: number;
        unlocked: boolean;
        unlockedAt: string | null;
    }>;
    prestigeNext: number | null;
    secret: boolean;
    currentStreakDays?: number;
    bestStreakDays?: number;
}

export interface AchievementEventRow {
    id: string;
    familyKey: string;
    rarity: AchievementRarity;
    eventType: AchievementEventType;
    prestigeValue: number | null;
    createdAt: Date;
    name: string;
    description: string;
    icon: AchievementIcon;
}

interface TierRow {
    familyKey: string;
    rarity: string;
    unlockedAt: Date;
    source: string;
}

interface MetaRow {
    userId: string;
    migratedAt: Date | null;
    featuredKeys: string;
    prestigeJson: string;
}

let progressiveTablesReady = false;

export async function ensureProgressiveAchievementTables() {
    if (progressiveTablesReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "user_achievement_tiers" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "familyKey" TEXT NOT NULL,
            "rarity" TEXT NOT NULL,
            "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "source" TEXT NOT NULL DEFAULT 'live',
            UNIQUE ("userId", "familyKey", "rarity")
        )
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "user_achievement_tiers_userId_idx"
        ON "user_achievement_tiers"("userId")
    `;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "user_achievement_events" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "familyKey" TEXT NOT NULL,
            "rarity" TEXT NOT NULL,
            "eventType" TEXT NOT NULL,
            "prestigeValue" INT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "consumedAt" TIMESTAMP(3) NULL
        )
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "user_achievement_events_userId_pending_idx"
        ON "user_achievement_events"("userId")
        WHERE "consumedAt" IS NULL
    `;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "user_achievement_meta" (
            "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
            "migratedAt" TIMESTAMP(3) NULL,
            "featuredKeys" TEXT NOT NULL DEFAULT '[]',
            "prestigeJson" TEXT NOT NULL DEFAULT '{}'
        )
    `;

    progressiveTablesReady = true;
}

function metricValueFor(
    stats: ProgressiveAchievementStats,
    metric: ProgressiveMetricKey
): number {
    if (metric === "completeAthlete") return 0;
    const raw = stats[metric as keyof ProgressiveAchievementStats];
    return typeof raw === "number" ? raw : 0;
}

function specialEarned(stats: ProgressiveAchievementStats, key: string): boolean {
    switch (key) {
        case "first-step":
            return stats.hasCompletedWorkout;
        case "first-checkin":
            return stats.hasCheckIn;
        case "first-pr":
            return stats.hasPr;
        case "first-weight-pr":
            return stats.hasWeightPr;
        case "first-rep-pr":
            return stats.hasRepPr;
        case "first-estimated-1rm":
            return stats.hasEstimated1RM;
        case "onboarding-complete":
            return stats.onboardingDone;
        case "first-plan":
            return stats.hasCreatedPlan;
        case "shared-plan":
            return stats.hasPublicPlan;
        case "worth-copying":
            return stats.hasPlanCopiedFromUser;
        case "perfect-month":
            return stats.hasPerfectMonth;
        case "flawless-100":
            return stats.hasFlawless100;
        case "one-year-strong":
            return stats.hasOneYearStrong;
        case "secret-comeback":
            return stats.hasComeback;
        case "secret-volume-day":
            return stats.hasVolumeDay;
        case "secret-early-bird":
            return stats.hasEarlyBird;
        default:
            return false;
    }
}

/** Highest Complete Athlete rarity earned from other families' highest rarities. */
export function rarityForCompleteAthlete(
    familyHighest: AchievementRarity[]
): AchievementRarity | null {
    const def = getProgressiveByKey("complete-athlete");
    if (!def) return null;

    const countAtLeast = (min: AchievementRarity) =>
        familyHighest.filter((r) => RARITY_RANK[r] >= RARITY_RANK[min]).length;

    let best: AchievementRarity | null = null;
    for (const rarity of ACHIEVEMENT_RARITIES) {
        const need = def.tiers[rarity];
        if (rarity === "legendary") {
            if (countAtLeast("epic") >= need && countAtLeast("legendary") >= 3) {
                best = rarity;
            }
        } else if (countAtLeast(rarity) >= need) {
            best = rarity;
        }
    }
    return best;
}

export function completeAthleteMetricValue(
    familyHighest: AchievementRarity[],
    targetRarity: AchievementRarity | null
): number {
    if (!targetRarity) {
        return familyHighest.filter((r) => RARITY_RANK[r] >= RARITY_RANK.legendary).length;
    }
    if (targetRarity === "legendary") {
        return familyHighest.filter((r) => RARITY_RANK[r] >= RARITY_RANK.epic).length;
    }
    return familyHighest.filter((r) => RARITY_RANK[r] >= RARITY_RANK[targetRarity]).length;
}

function parseFeaturedKeys(raw: string): string[] {
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((k): k is string => typeof k === "string").slice(0, 3);
    } catch {
        return [];
    }
}

function parsePrestigeJson(raw: string): Record<string, number> {
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object") return {};
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
        }
        return out;
    } catch {
        return {};
    }
}

async function getMeta(userId: string): Promise<MetaRow> {
    await ensureProgressiveAchievementTables();
    const rows = await prisma.$queryRaw<MetaRow[]>`
        SELECT "userId", "migratedAt", "featuredKeys", "prestigeJson"
        FROM "user_achievement_meta"
        WHERE "userId" = ${userId}
        LIMIT 1
    `;
    if (rows[0]) return rows[0];

    await prisma.$executeRaw`
        INSERT INTO "user_achievement_meta" ("userId")
        VALUES (${userId})
        ON CONFLICT ("userId") DO NOTHING
    `;
    return {
        userId,
        migratedAt: null,
        featuredKeys: "[]",
        prestigeJson: "{}",
    };
}

async function getTierRows(userId: string): Promise<TierRow[]> {
    await ensureProgressiveAchievementTables();
    return prisma.$queryRaw<TierRow[]>`
        SELECT "familyKey", "rarity", "unlockedAt", "source"
        FROM "user_achievement_tiers"
        WHERE "userId" = ${userId}
    `;
}

async function getLegacyUnlockIds(userId: string): Promise<Set<string>> {
    try {
        const rows = await prisma.$queryRaw<Array<{ achievementId: string }>>`
            SELECT "achievementId"
            FROM "user_achievements"
            WHERE "userId" = ${userId}
        `;
        return new Set(rows.map((r) => r.achievementId));
    } catch {
        return new Set();
    }
}

function mergeLegacyProgressive(
    earned: Map<string, AchievementRarity>,
    legacyIds: Set<string>
): void {
    for (const id of legacyIds) {
        const mapped = LEGACY_TO_PROGRESSIVE[id];
        if (!mapped) continue;
        const prev = earned.get(mapped.key);
        if (!prev || RARITY_RANK[mapped.rarity] > RARITY_RANK[prev]) {
            earned.set(mapped.key, mapped.rarity);
        }
    }
}

function allRaritiesUpTo(max: AchievementRarity): AchievementRarity[] {
    const out: AchievementRarity[] = [];
    for (const r of ACHIEVEMENT_RARITIES) {
        out.push(r);
        if (r === max) break;
    }
    return out;
}

async function insertTierSilent(
    userId: string,
    familyKey: string,
    rarities: AchievementRarity[],
    source: "migration" | "legacy" | "live"
): Promise<AchievementRarity[]> {
    const inserted: AchievementRarity[] = [];
    for (const rarity of rarities) {
        const id = randomUUID();
        try {
            const rows = await prisma.$queryRaw<Array<{ id: string }>>`
                INSERT INTO "user_achievement_tiers" ("id", "userId", "familyKey", "rarity", "source")
                VALUES (${id}, ${userId}, ${familyKey}, ${rarity}, ${source})
                ON CONFLICT ("userId", "familyKey", "rarity") DO NOTHING
                RETURNING "id"
            `;
            if (rows.length > 0) inserted.push(rarity);
        } catch (err) {
            console.error("[achievements/engine] tier insert failed", familyKey, rarity, err);
        }
    }
    return inserted;
}

async function insertEvent(input: {
    userId: string;
    familyKey: string;
    rarity: AchievementRarity;
    eventType: AchievementEventType;
    prestigeValue?: number | null;
}): Promise<string | null> {
    const id = randomUUID();
    try {
        await prisma.$executeRaw`
            INSERT INTO "user_achievement_events"
                ("id", "userId", "familyKey", "rarity", "eventType", "prestigeValue")
            VALUES (
                ${id},
                ${input.userId},
                ${input.familyKey},
                ${input.rarity},
                ${input.eventType},
                ${input.prestigeValue ?? null}
            )
        `;
        return id;
    } catch (err) {
        console.error("[achievements/engine] event insert failed", input, err);
        return null;
    }
}

async function notifyProgressiveUnlock(input: {
    userId: string;
    familyKey: string;
    rarity: AchievementRarity;
    name: string;
    eventType: AchievementEventType;
    prestigeValue?: number | null;
}) {
    await ensureNotificationsTable();
    const entityId = `${input.familyKey}:${input.rarity}${
        input.eventType === "milestone" && input.prestigeValue != null
            ? `:p${input.prestigeValue}`
            : ""
    }`;

    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "notifications"
        WHERE "userId" = ${input.userId}
          AND "type" = ${NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED}
          AND "entityId" = ${entityId}
        LIMIT 1
    `;
    if (existing.length > 0) return;

    const rarityLabel = RARITY_TOKENS[input.rarity].label;
    let message: string;
    if (input.eventType === "milestone" && input.prestigeValue != null) {
        message = `${rarityLabel} Achievement — ${input.name} reached prestige ${input.prestigeValue}.`;
    } else if (input.eventType === "upgrade") {
        message = `${rarityLabel} Achievement — ${input.name} upgraded to ${rarityLabel}.`;
    } else {
        message = `${rarityLabel} Achievement — ${input.name} unlocked.`;
    }

    await createNotification({
        userId: input.userId,
        type: NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED,
        message,
        entityType: "ACHIEVEMENT",
        entityId,
        route: `/achievements?focus=${input.familyKey}`,
    });
}

function computeEarnedFromStats(
    stats: ProgressiveAchievementStats
): Map<string, AchievementRarity> {
    const earned = new Map<string, AchievementRarity>();

    for (const def of PROGRESSIVE_ACHIEVEMENTS) {
        if (def.metric === "completeAthlete") continue;
        if (def.requiresPlanCreator && !stats.canCreatePlans) continue;

        const value = metricValueFor(stats, def.metric);
        const rarity = rarityForValue(def, value);
        if (rarity) earned.set(def.key, rarity);
    }

    return earned;
}

function applyCompleteAthlete(earned: Map<string, AchievementRarity>): AchievementRarity | null {
    const others: AchievementRarity[] = [];
    for (const def of PROGRESSIVE_ACHIEVEMENTS) {
        if (def.key === "complete-athlete") continue;
        const r = earned.get(def.key);
        if (r) others.push(r);
    }
    const ca = rarityForCompleteAthlete(others);
    if (ca) earned.set("complete-athlete", ca);
    else earned.delete("complete-athlete");
    return ca;
}

async function ensureFamilyTiersFromHighest(
    userId: string,
    familyKey: string,
    highest: AchievementRarity,
    existing: Map<string, Set<AchievementRarity>>,
    source: "migration" | "live",
    notify: boolean,
    name: string
): Promise<string[]> {
    const newlyUnlockedKeys: string[] = [];
    const have = existing.get(familyKey) ?? new Set<AchievementRarity>();
    const needed = allRaritiesUpTo(highest);
    const missing = needed.filter((r) => !have.has(r));
    if (missing.length === 0) return newlyUnlockedKeys;

    const hadAnyBefore = have.size > 0;
    const inserted = await insertTierSilent(userId, familyKey, missing, source);
    if (!existing.has(familyKey)) existing.set(familyKey, new Set());

    for (const r of inserted) {
        existing.get(familyKey)!.add(r);
        newlyUnlockedKeys.push(`${familyKey}:${r}`);

        if (notify && source === "live") {
            const isFirstForFamily = !hadAnyBefore && r === missing[0];
            const type: AchievementEventType = isFirstForFamily ? "unlock" : "upgrade";
            await insertEvent({ userId, familyKey, rarity: r, eventType: type });
            await notifyProgressiveUnlock({
                userId,
                familyKey,
                rarity: r,
                name,
                eventType: type,
            });
        }
    }

    return newlyUnlockedKeys;
}

async function runMigration(userId: string, stats: ProgressiveAchievementStats): Promise<void> {
    const legacyIds = await getLegacyUnlockIds(userId);
    const earned = computeEarnedFromStats(stats);
    mergeLegacyProgressive(earned, legacyIds);
    applyCompleteAthlete(earned);

    for (const [familyKey, highest] of earned) {
        if (!getProgressiveByKey(familyKey)) continue;
        await insertTierSilent(userId, familyKey, allRaritiesUpTo(highest), "migration");
    }

    for (const special of SPECIAL_ACHIEVEMENTS) {
        const fromStats = specialEarned(stats, special.key);
        const fromLegacy = [...legacyIds].some((id) => LEGACY_TO_SPECIAL[id] === special.key);
        if (!fromStats && !fromLegacy) continue;
        await insertTierSilent(userId, special.key, [special.rarity], "migration");
    }

    const prestige: Record<string, number> = {};
    for (const def of PROGRESSIVE_ACHIEVEMENTS) {
        if (!def.prestigeMilestones?.length) continue;
        if (def.requiresPlanCreator && !stats.canCreatePlans) continue;
        const value = metricValueFor(stats, def.metric);
        let maxHit = 0;
        for (const m of def.prestigeMilestones) {
            if (value >= m) maxHit = m;
        }
        if (maxHit > 0) prestige[def.key] = maxHit;
    }

    await prisma.$executeRaw`
        UPDATE "user_achievement_meta"
        SET "migratedAt" = CURRENT_TIMESTAMP,
            "prestigeJson" = ${JSON.stringify(prestige)}
        WHERE "userId" = ${userId}
    `;
}

async function syncLive(
    userId: string,
    stats: ProgressiveAchievementStats,
    existingTiers: TierRow[],
    prestigeMap: Record<string, number>
): Promise<string[]> {
    const newlyUnlockedKeys: string[] = [];
    const existing = new Map<string, Set<AchievementRarity>>();
    for (const row of existingTiers) {
        if (!ACHIEVEMENT_RARITIES.includes(row.rarity as AchievementRarity)) continue;
        if (!existing.has(row.familyKey)) existing.set(row.familyKey, new Set());
        existing.get(row.familyKey)!.add(row.rarity as AchievementRarity);
    }

    for (const def of PROGRESSIVE_ACHIEVEMENTS) {
        if (def.metric === "completeAthlete") continue;
        if (def.requiresPlanCreator && !stats.canCreatePlans) continue;

        const value = metricValueFor(stats, def.metric);
        const fromValue = rarityForValue(def, value);
        if (!fromValue) continue;

        const keys = await ensureFamilyTiersFromHighest(
            userId,
            def.key,
            fromValue,
            existing,
            "live",
            true,
            def.name
        );
        newlyUnlockedKeys.push(...keys);

        const have = existing.get(def.key);
        const hasLegendary = have?.has("legendary");
        if (hasLegendary && def.prestigeMilestones?.length) {
            const prevPrestige = prestigeMap[def.key] ?? 0;
            for (const milestone of def.prestigeMilestones) {
                if (value < milestone || milestone <= prevPrestige) continue;
                prestigeMap[def.key] = Math.max(prestigeMap[def.key] ?? 0, milestone);
                await insertEvent({
                    userId,
                    familyKey: def.key,
                    rarity: "legendary",
                    eventType: "milestone",
                    prestigeValue: milestone,
                });
                await notifyProgressiveUnlock({
                    userId,
                    familyKey: def.key,
                    rarity: "legendary",
                    name: def.name,
                    eventType: "milestone",
                    prestigeValue: milestone,
                });
                newlyUnlockedKeys.push(`${def.key}:prestige:${milestone}`);
            }
        }
    }

    const others: AchievementRarity[] = [];
    for (const def of PROGRESSIVE_ACHIEVEMENTS) {
        if (def.key === "complete-athlete") continue;
        const have = existing.get(def.key);
        const h = have ? highestRarity([...have]) : null;
        if (h) others.push(h);
    }
    const caRarity = rarityForCompleteAthlete(others);
    if (caRarity) {
        const caDef = getProgressiveByKey("complete-athlete");
        const keys = await ensureFamilyTiersFromHighest(
            userId,
            "complete-athlete",
            caRarity,
            existing,
            "live",
            true,
            caDef?.name ?? "Complete Athlete"
        );
        newlyUnlockedKeys.push(...keys);
    }

    for (const special of SPECIAL_ACHIEVEMENTS) {
        if (!specialEarned(stats, special.key)) continue;
        const have = existing.get(special.key);
        if (have?.has(special.rarity)) continue;

        const inserted = await insertTierSilent(
            userId,
            special.key,
            [special.rarity],
            "live"
        );
        if (inserted.length === 0) continue;
        if (!existing.has(special.key)) existing.set(special.key, new Set());
        existing.get(special.key)!.add(special.rarity);
        newlyUnlockedKeys.push(`${special.key}:${special.rarity}`);
        await insertEvent({
            userId,
            familyKey: special.key,
            rarity: special.rarity,
            eventType: "unlock",
        });
        await notifyProgressiveUnlock({
            userId,
            familyKey: special.key,
            rarity: special.rarity,
            name: special.name,
            eventType: "unlock",
        });
    }

    await prisma.$executeRaw`
        UPDATE "user_achievement_meta"
        SET "prestigeJson" = ${JSON.stringify(prestigeMap)}
        WHERE "userId" = ${userId}
    `;

    return newlyUnlockedKeys;
}

export async function syncProgressiveAchievements(
    userId: string
): Promise<{ newlyUnlockedKeys: string[] }> {
    await ensureProgressiveAchievementTables();
    const stats = await getProgressiveAchievementStats(userId);
    const meta = await getMeta(userId);

    if (!meta.migratedAt) {
        await runMigration(userId, stats);
        return { newlyUnlockedKeys: [] };
    }

    const tiers = await getTierRows(userId);
    const prestigeMap = parsePrestigeJson(meta.prestigeJson);
    const newlyUnlockedKeys = await syncLive(userId, stats, tiers, prestigeMap);
    return { newlyUnlockedKeys };
}

function unlockHintForProgressive(
    name: string,
    unit: string,
    nextReq: number | null,
    prestigeNext: number | null
): string {
    if (prestigeNext != null) {
        return `Reach ${prestigeNext} ${unit} for the next prestige milestone.`;
    }
    if (nextReq != null) {
        return `Reach ${nextReq} ${unit} to unlock the next tier of ${name}.`;
    }
    return `You've mastered ${name}.`;
}

export async function getProgressiveDisplay(
    userId: string
): Promise<ProgressiveDisplayItem[]> {
    await ensureProgressiveAchievementTables();
    const [stats, tiers, meta] = await Promise.all([
        getProgressiveAchievementStats(userId),
        getTierRows(userId),
        getMeta(userId),
    ]);
    const prestigeMap = parsePrestigeJson(meta.prestigeJson);

    const tierMap = new Map<string, Map<AchievementRarity, Date>>();
    for (const row of tiers) {
        if (!ACHIEVEMENT_RARITIES.includes(row.rarity as AchievementRarity)) continue;
        if (!tierMap.has(row.familyKey)) tierMap.set(row.familyKey, new Map());
        tierMap.get(row.familyKey)!.set(row.rarity as AchievementRarity, row.unlockedAt);
    }

    const familyHighestForCA: AchievementRarity[] = [];
    for (const def of PROGRESSIVE_ACHIEVEMENTS) {
        if (def.key === "complete-athlete") continue;
        const m = tierMap.get(def.key);
        if (!m || m.size === 0) continue;
        const h = highestRarity([...m.keys()]);
        if (h) familyHighestForCA.push(h);
    }

    const items: ProgressiveDisplayItem[] = [];

    for (const def of PROGRESSIVE_ACHIEVEMENTS) {
        const unlockedMap = tierMap.get(def.key) ?? new Map();
        const highest = unlockedMap.size > 0 ? highestRarity([...unlockedMap.keys()]) : null;
        const next = nextRarity(highest);

        let value: number;
        if (def.metric === "completeAthlete") {
            value = completeAthleteMetricValue(familyHighestForCA, highest ? next : "common");
        } else {
            value = metricValueFor(stats, def.metric);
        }

        const lockedByRole = Boolean(def.requiresPlanCreator && !stats.canCreatePlans);
        const unlocked = highest != null && !lockedByRole;

        let prestigeNext: number | null = null;
        if (highest === "legendary" && def.prestigeMilestones?.length) {
            const prev = prestigeMap[def.key] ?? 0;
            prestigeNext = def.prestigeMilestones.find((m) => m > prev) ?? null;
        }

        const nextReq = next
            ? tierRequirement(def, next)
            : !highest
              ? tierRequirement(def, "common")
              : null;

        const progressTarget =
            prestigeNext
            ?? (next
                ? tierRequirement(def, next)
                : !highest
                  ? tierRequirement(def, "common")
                  : null);

        const progress =
            progressTarget != null
                ? { current: Math.min(value, progressTarget), target: progressTarget }
                : null;

        const displayRarity: AchievementRarity = highest ?? "common";
        const highestUnlockAt = highest ? unlockedMap.get(highest) ?? null : null;

        items.push({
            id: def.key,
            title: def.name,
            description: def.description,
            unlockHint: unlockHintForProgressive(def.name, def.unit, nextReq, prestigeNext),
            rarity: displayRarity,
            icon: def.icon,
            unlocked,
            unlockedAt: highestUnlockAt?.toISOString() ?? null,
            progress,
            kind: "progressive",
            category: def.category,
            highestRarity: highest,
            nextRarity: next,
            metricValue: value,
            unit: def.unit,
            tierHistory: ACHIEVEMENT_RARITIES.map((rarity) => ({
                rarity,
                requirement: tierRequirement(def, rarity),
                unlocked: unlockedMap.has(rarity),
                unlockedAt: unlockedMap.get(rarity)?.toISOString() ?? null,
            })),
            prestigeNext,
            secret: false,
            ...(def.key === "consistency"
                ? {
                      currentStreakDays: stats.currentStreakDays,
                      bestStreakDays: stats.bestStreakDays,
                  }
                : {}),
            ...(def.key === "checkin-consistency"
                ? {
                      currentStreakDays: stats.checkInCurrentStreak,
                      bestStreakDays: stats.checkInBestStreak,
                  }
                : {}),
        });
    }

    for (const special of SPECIAL_ACHIEVEMENTS) {
        const unlockedMap = tierMap.get(special.key);
        const isUnlocked = Boolean(unlockedMap?.has(special.rarity));
        const unlockedAt = unlockedMap?.get(special.rarity) ?? null;
        const isSecretLocked = Boolean(special.secret) && !isUnlocked;

        items.push({
            id: special.key,
            title: isSecretLocked ? "???" : special.name,
            description: isSecretLocked ? "Secret Achievement" : special.description,
            unlockHint: isSecretLocked ? "" : special.description,
            rarity: special.rarity,
            icon: special.icon,
            unlocked: isUnlocked,
            unlockedAt: unlockedAt?.toISOString() ?? null,
            progress: null,
            kind: "special",
            category: special.category,
            highestRarity: isUnlocked ? special.rarity : null,
            nextRarity: null,
            metricValue: isUnlocked ? 1 : 0,
            unit: "",
            tierHistory: [
                {
                    rarity: special.rarity,
                    requirement: 1,
                    unlocked: isUnlocked,
                    unlockedAt: unlockedAt?.toISOString() ?? null,
                },
            ],
            prestigeNext: null,
            secret: Boolean(special.secret),
        });
    }

    return items;
}

export async function getPendingAchievementEvents(
    userId: string
): Promise<AchievementEventRow[]> {
    await ensureProgressiveAchievementTables();
    const rows = await prisma.$queryRaw<
        Array<{
            id: string;
            familyKey: string;
            rarity: string;
            eventType: string;
            prestigeValue: number | null;
            createdAt: Date;
        }>
    >`
        SELECT "id", "familyKey", "rarity", "eventType", "prestigeValue", "createdAt"
        FROM "user_achievement_events"
        WHERE "userId" = ${userId}
          AND "consumedAt" IS NULL
        ORDER BY "createdAt" ASC
        LIMIT 50
    `;

    return rows.map((row) => {
        const progressive = getProgressiveByKey(row.familyKey);
        const special = getSpecialByKey(row.familyKey);
        const rarity = (
            ACHIEVEMENT_RARITIES.includes(row.rarity as AchievementRarity)
                ? row.rarity
                : "common"
        ) as AchievementRarity;
        return {
            id: row.id,
            familyKey: row.familyKey,
            rarity,
            eventType: row.eventType as AchievementEventType,
            prestigeValue: row.prestigeValue,
            createdAt: row.createdAt,
            name: progressive?.name ?? special?.name ?? row.familyKey,
            description: progressive?.description ?? special?.description ?? "",
            icon: progressive?.icon ?? special?.icon ?? "trophy",
        };
    });
}

export async function consumeAchievementEvent(
    userId: string,
    eventId: string
): Promise<boolean> {
    await ensureProgressiveAchievementTables();
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        UPDATE "user_achievement_events"
        SET "consumedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${eventId}
          AND "userId" = ${userId}
          AND "consumedAt" IS NULL
        RETURNING "id"
    `;
    return rows.length > 0;
}

export async function getFeaturedAchievementKeys(userId: string): Promise<string[]> {
    const meta = await getMeta(userId);
    return parseFeaturedKeys(meta.featuredKeys);
}

export async function setFeaturedAchievementKeys(
    userId: string,
    keys: string[]
): Promise<string[]> {
    await ensureProgressiveAchievementTables();
    const cleaned = [...new Set(keys.filter(Boolean))].slice(0, 3);
    await prisma.$executeRaw`
        INSERT INTO "user_achievement_meta" ("userId", "featuredKeys")
        VALUES (${userId}, ${JSON.stringify(cleaned)})
        ON CONFLICT ("userId") DO UPDATE SET "featuredKeys" = EXCLUDED."featuredKeys"
    `;
    return cleaned;
}

export function pickAutoFeatured(
    items: ProgressiveDisplayItem[],
    limit = 3
): ProgressiveDisplayItem[] {
    return items
        .filter((item) => item.unlocked)
        .sort((a, b) => {
            const rankDiff = RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity];
            if (rankDiff !== 0) return rankDiff;
            const aTime = a.unlockedAt ? new Date(a.unlockedAt).getTime() : 0;
            const bTime = b.unlockedAt ? new Date(b.unlockedAt).getTime() : 0;
            return bTime - aTime;
        })
        .slice(0, limit);
}

export type { StreakDisplay } from "./rarity";
export { formatStreakDisplay } from "./rarity";
