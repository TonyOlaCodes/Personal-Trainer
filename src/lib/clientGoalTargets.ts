/**
 * Canonical client coaching targets.
 *
 * Source of truth: `users.targetWeightKg`, `users.goal`, and the daily-metric
 * target columns on `users` (`targetCalories`, `targetSteps`, `targetSleepHours`).
 *
 * `client_goals` is a legacy table. On boot we copy any values that exist only
 * there onto the user row, then keep `client_goals` synchronized as a derived
 * mirror so it cannot drift into a second competing store.
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Goal } from "@prisma/client";
import {
    ensureDailyMetricTargetColumns,
    getDailyMetricTargets,
    normalizeCalories,
    normalizeSleepHours,
    normalizeSteps,
    updateDailyMetricTargets,
    type DailyMetricTargets,
} from "@/lib/dailyMetrics";

export interface ClientGoalTargets extends DailyMetricTargets {
    goal: Goal | null;
    targetWeightKg: number | null;
}

export function normalizeTargetWeightKg(value: number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    if (!Number.isFinite(value) || value < 0 || value > 500) {
        throw new Error("Invalid target weight");
    }
    return Math.round(value * 100) / 100;
}

let clientGoalsTableReady = false;

export async function ensureClientGoalsTable() {
    if (clientGoalsTableReady) return;
    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "client_goals" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
            "stepGoal" INTEGER,
            "calorieGoal" INTEGER,
            "weightGoalKg" DOUBLE PRECISION
        )
    `;
    clientGoalsTableReady = true;
}

/**
 * One-way migrate leftover `client_goals` values into the user row when the
 * canonical field is empty, then rewrite the legacy row to match.
 */
export async function migrateLegacyClientGoals() {
    await ensureDailyMetricTargetColumns();
    await ensureClientGoalsTable();

    await prisma.$executeRaw`
        UPDATE "users" AS u
        SET
            "targetWeightKg" = COALESCE(u."targetWeightKg", cg."weightGoalKg"),
            "targetCalories" = COALESCE(u."targetCalories", cg."calorieGoal"),
            "targetSteps" = COALESCE(u."targetSteps", cg."stepGoal")
        FROM "client_goals" AS cg
        WHERE cg."userId" = u."id"
    `;

    await syncLegacyClientGoalsMirror();
}

async function syncLegacyClientGoalsMirror(userId?: string) {
    await ensureClientGoalsTable();

    const users = await prisma.$queryRaw<Array<{
        id: string;
        targetSteps: number | null;
        targetCalories: number | null;
        targetWeightKg: number | null;
    }>>`
        SELECT "id", "targetSteps", "targetCalories", "targetWeightKg"
        FROM "users"
        WHERE (${userId ?? null}::text IS NULL OR "id" = ${userId ?? null})
          AND (
            "targetSteps" IS NOT NULL
            OR "targetCalories" IS NOT NULL
            OR "targetWeightKg" IS NOT NULL
            OR ${userId ?? null}::text IS NOT NULL
          )
    `;

    for (const user of users) {
        await prisma.$executeRaw`
            INSERT INTO "client_goals" ("id", "userId", "stepGoal", "calorieGoal", "weightGoalKg")
            VALUES (${randomUUID()}, ${user.id}, ${user.targetSteps}, ${user.targetCalories}, ${user.targetWeightKg})
            ON CONFLICT ("userId") DO UPDATE SET
                "stepGoal" = EXCLUDED."stepGoal",
                "calorieGoal" = EXCLUDED."calorieGoal",
                "weightGoalKg" = EXCLUDED."weightGoalKg"
        `;
    }
}

export async function getClientGoalTargets(userId: string): Promise<ClientGoalTargets> {
    await ensureDailyMetricTargetColumns();
    const [user, metrics] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: { goal: true, targetWeightKg: true },
        }),
        getDailyMetricTargets(userId),
    ]);

    return {
        goal: user?.goal ?? null,
        targetWeightKg: user?.targetWeightKg ?? null,
        targetCalories: metrics.targetCalories,
        targetSteps: metrics.targetSteps,
        targetSleepHours: metrics.targetSleepHours,
    };
}

export async function updateClientGoalTargets(
    userId: string,
    patch: Partial<ClientGoalTargets>
): Promise<ClientGoalTargets> {
    await ensureDailyMetricTargetColumns();
    const current = await getClientGoalTargets(userId);

    const next: ClientGoalTargets = {
        goal: patch.goal !== undefined ? patch.goal : current.goal,
        targetWeightKg: patch.targetWeightKg !== undefined
            ? normalizeTargetWeightKg(patch.targetWeightKg)
            : current.targetWeightKg,
        targetCalories: patch.targetCalories !== undefined
            ? normalizeCalories(patch.targetCalories)
            : current.targetCalories,
        targetSteps: patch.targetSteps !== undefined
            ? normalizeSteps(patch.targetSteps)
            : current.targetSteps,
        targetSleepHours: patch.targetSleepHours !== undefined
            ? normalizeSleepHours(patch.targetSleepHours)
            : current.targetSleepHours,
    };

    if (patch.goal !== undefined || patch.targetWeightKg !== undefined) {
        await prisma.user.update({
            where: { id: userId },
            data: {
                ...(patch.goal !== undefined ? { goal: next.goal } : {}),
                ...(patch.targetWeightKg !== undefined ? { targetWeightKg: next.targetWeightKg } : {}),
            },
        });
    }

    if (
        patch.targetCalories !== undefined
        || patch.targetSteps !== undefined
        || patch.targetSleepHours !== undefined
    ) {
        await updateDailyMetricTargets(userId, {
            targetCalories: next.targetCalories,
            targetSteps: next.targetSteps,
            targetSleepHours: next.targetSleepHours,
        });
    }

    await syncLegacyClientGoalsMirror(userId);
    return getClientGoalTargets(userId);
}
