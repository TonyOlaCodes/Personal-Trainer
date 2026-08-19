import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateKey } from "@/lib/utils";

type PauseDb = PrismaClient | Prisma.TransactionClient;

export type CoachPauseStatus = {
    isCoachPaused: boolean;
    coachPausedAt: Date | null;
    coachResumedAt: Date | null;
};

let coachPauseColumnsReady = false;

/** Runtime ensure — safe on production DBs that may not have run the migration yet. */
export async function ensureCoachClientPauseColumns(db: PauseDb = prisma) {
    if (coachPauseColumnsReady) return;

    await db.$executeRawUnsafe(
        'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isCoachPaused" BOOLEAN NOT NULL DEFAULT false'
    );
    await db.$executeRawUnsafe(
        'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "coachPausedAt" TIMESTAMP(3)'
    );
    await db.$executeRawUnsafe(
        'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "coachResumedAt" TIMESTAMP(3)'
    );

    coachPauseColumnsReady = true;
}

export function isClientPausedByCoach(user: { isCoachPaused?: boolean | null }): boolean {
    return Boolean(user.isCoachPaused);
}

/**
 * Suppress coach-facing missed workout / check-in noise for paused clients,
 * and for events that occurred before the latest resume (no pause-period backlog).
 */
export function shouldSuppressCoachMissedAttention(
    client: {
        isCoachPaused?: boolean | null;
        coachResumedAt?: Date | string | null;
    },
    eventDateKey?: string | null
): boolean {
    if (isClientPausedByCoach(client)) return true;

    if (!eventDateKey || !client.coachResumedAt) return false;

    const resumedAt =
        client.coachResumedAt instanceof Date
            ? client.coachResumedAt
            : new Date(client.coachResumedAt);
    if (Number.isNaN(resumedAt.getTime())) return false;

    const resumedKey = toDateKey(resumedAt);
    return eventDateKey < resumedKey;
}

export async function getCoachPauseStatusMap(
    userIds: string[],
    db: PauseDb = prisma
): Promise<Map<string, CoachPauseStatus>> {
    await ensureCoachClientPauseColumns(db);
    if (userIds.length === 0) return new Map();

    const rows = await db.$queryRaw<Array<{
        id: string;
        isCoachPaused: boolean;
        coachPausedAt: Date | null;
        coachResumedAt: Date | null;
    }>>`
        SELECT "id", "isCoachPaused", "coachPausedAt", "coachResumedAt"
        FROM "users"
        WHERE "id" IN (${Prisma.join(userIds)})
    `;

    return new Map(
        rows.map((row) => [
            row.id,
            {
                isCoachPaused: Boolean(row.isCoachPaused),
                coachPausedAt: row.coachPausedAt,
                coachResumedAt: row.coachResumedAt,
            },
        ])
    );
}

export async function getCoachPauseStatus(
    userId: string,
    db: PauseDb = prisma
): Promise<CoachPauseStatus> {
    const map = await getCoachPauseStatusMap([userId], db);
    return map.get(userId) ?? {
        isCoachPaused: false,
        coachPausedAt: null,
        coachResumedAt: null,
    };
}

/** Coach pauses a client — silences alerts; client account stays fully usable. */
export async function pauseClientForCoach(clientId: string, db: PauseDb = prisma) {
    await ensureCoachClientPauseColumns(db);
    await db.$executeRaw`
        UPDATE "users"
        SET "isCoachPaused" = true,
            "coachPausedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${clientId}
    `;
}

/** Coach manually resumes a paused client. */
export async function resumeClientForCoach(clientId: string, db: PauseDb = prisma) {
    await ensureCoachClientPauseColumns(db);
    await db.$executeRaw`
        UPDATE "users"
        SET "isCoachPaused" = false,
            "coachResumedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${clientId}
          AND "isCoachPaused" = true
    `;
}

/**
 * If the client is coach-paused, clear pause on meaningful activity.
 * Silent for the client — no notification.
 * Returns true when a resume actually happened.
 */
export async function maybeAutoResumeCoachPausedClient(
    userId: string,
    db: PauseDb = prisma
): Promise<boolean> {
    await ensureCoachClientPauseColumns(db);
    const result = await db.$executeRaw`
        UPDATE "users"
        SET "isCoachPaused" = false,
            "coachResumedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${userId}
          AND "isCoachPaused" = true
    `;
    // Prisma executeRaw returns number of rows affected on Postgres adapters
    return typeof result === "number" ? result > 0 : true;
}
