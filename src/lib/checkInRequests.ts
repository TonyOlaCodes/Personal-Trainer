import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

/** Minimum gap between deliberate re-requests for the same period (spam guard). */
export const CHECK_IN_REQUEST_COOLDOWN_MS = 60_000;

export interface CheckInRequestRow {
    id: string;
    coachId: string;
    clientId: string;
    weekNumber: number;
    periodDueDateKey: string | null;
    requestedAt: Date;
    lastRequestedAt: Date;
    clearedAt: Date | null;
}

let tableReady = false;

export async function ensureCheckInRequestsTable() {
    if (tableReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "check_in_requests" (
            "id" TEXT PRIMARY KEY,
            "coachId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "clientId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "weekNumber" INTEGER NOT NULL,
            "periodDueDateKey" TEXT,
            "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "lastRequestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "clearedAt" TIMESTAMP(3),
            UNIQUE ("clientId", "weekNumber")
        )
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "check_in_requests_client_active_idx"
        ON "check_in_requests"("clientId")
        WHERE "clearedAt" IS NULL
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "check_in_requests_coach_active_idx"
        ON "check_in_requests"("coachId")
        WHERE "clearedAt" IS NULL
    `;

    tableReady = true;
}

function mapRow(row: {
    id: string;
    coachId: string;
    clientId: string;
    weekNumber: number;
    periodDueDateKey: string | null;
    requestedAt: Date;
    lastRequestedAt: Date;
    clearedAt: Date | null;
}): CheckInRequestRow {
    return {
        id: row.id,
        coachId: row.coachId,
        clientId: row.clientId,
        weekNumber: Number(row.weekNumber),
        periodDueDateKey: row.periodDueDateKey,
        requestedAt: new Date(row.requestedAt),
        lastRequestedAt: new Date(row.lastRequestedAt),
        clearedAt: row.clearedAt ? new Date(row.clearedAt) : null,
    };
}

export function buildCheckInRequestEntityId(clientId: string, weekNumber: number) {
    return `${clientId}:${weekNumber}`;
}

export function checkInRequestDeepLink(weekNumber: number) {
    return `/checkins?week=${weekNumber}&start=1`;
}

/**
 * Upsert an active coach request for a specific client + outstanding week.
 * Re-requests update the same row (no duplicate outstanding records).
 */
export async function upsertCheckInRequest(input: {
    coachId: string;
    clientId: string;
    weekNumber: number;
    periodDueDateKey?: string | null;
    /** When true, reject if lastRequestedAt is within cooldown. */
    enforceCooldown?: boolean;
}): Promise<{ request: CheckInRequestRow; created: boolean; throttled: boolean }> {
    await ensureCheckInRequestsTable();

    const existing = await prisma.$queryRaw<Array<{
        id: string;
        coachId: string;
        clientId: string;
        weekNumber: number;
        periodDueDateKey: string | null;
        requestedAt: Date;
        lastRequestedAt: Date;
        clearedAt: Date | null;
    }>>`
        SELECT "id", "coachId", "clientId", "weekNumber", "periodDueDateKey",
               "requestedAt", "lastRequestedAt", "clearedAt"
        FROM "check_in_requests"
        WHERE "clientId" = ${input.clientId}
          AND "weekNumber" = ${input.weekNumber}
        LIMIT 1
    `;

    const row = existing[0] ? mapRow(existing[0]) : null;
    const now = new Date();

    if (row && !row.clearedAt && input.enforceCooldown !== false) {
        const elapsed = now.getTime() - row.lastRequestedAt.getTime();
        if (elapsed < CHECK_IN_REQUEST_COOLDOWN_MS) {
            return { request: row, created: false, throttled: true };
        }
    }

    const periodKey = input.periodDueDateKey ?? row?.periodDueDateKey ?? null;

    if (row) {
        const nextRequestedAt = row.clearedAt ? now : row.requestedAt;
        await prisma.$executeRaw`
            UPDATE "check_in_requests"
            SET "coachId" = ${input.coachId},
                "periodDueDateKey" = ${periodKey},
                "lastRequestedAt" = ${now},
                "requestedAt" = ${nextRequestedAt},
                "clearedAt" = NULL
            WHERE "id" = ${row.id}
        `;
        const updated = await getCheckInRequestById(row.id);
        return {
            request: updated ?? {
                ...row,
                coachId: input.coachId,
                periodDueDateKey: periodKey,
                requestedAt: nextRequestedAt,
                lastRequestedAt: now,
                clearedAt: null,
            },
            created: Boolean(row.clearedAt),
            throttled: false,
        };
    }

    const id = randomUUID();
    await prisma.$executeRaw`
        INSERT INTO "check_in_requests"
            ("id", "coachId", "clientId", "weekNumber", "periodDueDateKey", "requestedAt", "lastRequestedAt", "clearedAt")
        VALUES
            (${id}, ${input.coachId}, ${input.clientId}, ${input.weekNumber}, ${periodKey}, ${now}, ${now}, NULL)
    `;

    const created = await getCheckInRequestById(id);
    return {
        request: created ?? {
            id,
            coachId: input.coachId,
            clientId: input.clientId,
            weekNumber: input.weekNumber,
            periodDueDateKey: periodKey,
            requestedAt: now,
            lastRequestedAt: now,
            clearedAt: null,
        },
        created: true,
        throttled: false,
    };
}

export async function getCheckInRequestById(id: string): Promise<CheckInRequestRow | null> {
    await ensureCheckInRequestsTable();
    const rows = await prisma.$queryRaw<Array<{
        id: string;
        coachId: string;
        clientId: string;
        weekNumber: number;
        periodDueDateKey: string | null;
        requestedAt: Date;
        lastRequestedAt: Date;
        clearedAt: Date | null;
    }>>`
        SELECT "id", "coachId", "clientId", "weekNumber", "periodDueDateKey",
               "requestedAt", "lastRequestedAt", "clearedAt"
        FROM "check_in_requests"
        WHERE "id" = ${id}
        LIMIT 1
    `;
    return rows[0] ? mapRow(rows[0]) : null;
}

/** Permanently clear an active request for this client + week (submit / dismiss / delete). */
export async function clearCheckInRequest(clientId: string, weekNumber: number) {
    await ensureCheckInRequestsTable();
    await prisma.$executeRaw`
        UPDATE "check_in_requests"
        SET "clearedAt" = CURRENT_TIMESTAMP
        WHERE "clientId" = ${clientId}
          AND "weekNumber" = ${weekNumber}
          AND "clearedAt" IS NULL
    `;
}

/** Active requests for a coach, keyed by `clientId:weekNumber`. */
export async function getActiveCheckInRequestMapForCoach(
    coachId: string
): Promise<Map<string, CheckInRequestRow>> {
    await ensureCheckInRequestsTable();
    const rows = await prisma.$queryRaw<Array<{
        id: string;
        coachId: string;
        clientId: string;
        weekNumber: number;
        periodDueDateKey: string | null;
        requestedAt: Date;
        lastRequestedAt: Date;
        clearedAt: Date | null;
    }>>`
        SELECT "id", "coachId", "clientId", "weekNumber", "periodDueDateKey",
               "requestedAt", "lastRequestedAt", "clearedAt"
        FROM "check_in_requests"
        WHERE "coachId" = ${coachId}
          AND "clearedAt" IS NULL
    `;

    const map = new Map<string, CheckInRequestRow>();
    for (const row of rows) {
        const mapped = mapRow(row);
        map.set(`${mapped.clientId}:${mapped.weekNumber}`, mapped);
    }
    return map;
}

/**
 * Oldest / most overdue active request for a client (one popup at a time).
 */
export async function getPriorityActiveCheckInRequestForClient(
    clientId: string
): Promise<CheckInRequestRow | null> {
    await ensureCheckInRequestsTable();
    const rows = await prisma.$queryRaw<Array<{
        id: string;
        coachId: string;
        clientId: string;
        weekNumber: number;
        periodDueDateKey: string | null;
        requestedAt: Date;
        lastRequestedAt: Date;
        clearedAt: Date | null;
    }>>`
        SELECT "id", "coachId", "clientId", "weekNumber", "periodDueDateKey",
               "requestedAt", "lastRequestedAt", "clearedAt"
        FROM "check_in_requests"
        WHERE "clientId" = ${clientId}
          AND "clearedAt" IS NULL
        ORDER BY
            "periodDueDateKey" ASC NULLS LAST,
            "weekNumber" ASC,
            "requestedAt" ASC
        LIMIT 1
    `;
    return rows[0] ? mapRow(rows[0]) : null;
}
