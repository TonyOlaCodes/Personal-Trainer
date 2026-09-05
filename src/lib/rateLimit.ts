/**
 * Shared application rate limiter.
 *
 * Identity is always the authenticated TOLG user id, or the request IP for
 * public endpoints. Caller-supplied clientId / receiverId / userId are never
 * part of the bucket, so swapping those parameters cannot reset a limit.
 *
 * Storage is Postgres so the counter is shared across Vercel instances.
 * Tests can inject an in-memory store of the same algorithm.
 */

import { NextResponse } from "next/server";

export type RateLimitPolicy =
    | "codeValidate"
    | "codeRedeem"
    | "planImport"
    | "coachCodeRequest"
    | "accessRequest"
    | "upload"
    | "messageSend"
    | "messageReact"
    | "checkInWrite"
    | "checkInRequest"
    | "coachNotify"
    | "coachClientNote";

export interface RateLimitRule {
    limit: number;
    windowMs: number;
}

/**
 * Limits chosen for what the endpoint can be abused for, not for normal
 * workout autosave / presence / polling (those are not limited here).
 */
export const RATE_LIMIT_RULES: Record<RateLimitPolicy, RateLimitRule> = {
    // Code/token guessing — tight on purpose.
    codeValidate: { limit: 10, windowMs: 15 * 60_000 },
    codeRedeem: { limit: 8, windowMs: 15 * 60_000 },
    planImport: { limit: 8, windowMs: 15 * 60_000 },
    coachCodeRequest: { limit: 5, windowMs: 60 * 60_000 },
    accessRequest: { limit: 8, windowMs: 60 * 60_000 },
    // Spam / abuse of other users.
    upload: { limit: 20, windowMs: 15 * 60_000 },
    messageSend: { limit: 40, windowMs: 60_000 },
    messageReact: { limit: 60, windowMs: 60_000 },
    checkInWrite: { limit: 12, windowMs: 60 * 60_000 },
    checkInRequest: { limit: 10, windowMs: 60 * 60_000 },
    coachNotify: { limit: 12, windowMs: 15 * 60_000 },
    coachClientNote: { limit: 30, windowMs: 15 * 60_000 },
};

export interface RateLimitStore {
    consume(bucket: string, windowMs: number, now: number): Promise<number>;
}

export interface RateLimitWindowState {
    windowStart: number;
    count: number;
}

/** Pure window math used by every store implementation. */
export function nextWindowState(
    current: RateLimitWindowState | null,
    windowMs: number,
    now: number
): RateLimitWindowState {
    if (!current || now - current.windowStart >= windowMs) {
        return { windowStart: now, count: 1 };
    }
    return { windowStart: current.windowStart, count: current.count + 1 };
}

export function createMemoryRateLimitStore(): RateLimitStore {
    const windows = new Map<string, RateLimitWindowState>();
    return {
        async consume(bucket, windowMs, now) {
            const next = nextWindowState(windows.get(bucket) ?? null, windowMs, now);
            windows.set(bucket, next);
            return next.count;
        },
    };
}

let tableReady = false;

export async function ensureRateLimitTable() {
    if (tableReady) return;
    const { prisma } = await import("@/lib/prisma");
    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "rate_limit_windows" (
            "bucket" TEXT PRIMARY KEY,
            "windowStart" TIMESTAMP(3) NOT NULL,
            "count" INTEGER NOT NULL
        )
    `;
    tableReady = true;
}

function createPostgresRateLimitStore(): RateLimitStore {
    return {
        async consume(bucket, windowMs, now) {
            const { prisma } = await import("@/lib/prisma");
            await ensureRateLimitTable();
            const windowStart = new Date(now);
            const expireBefore = new Date(now - windowMs);

            const rows = await prisma.$queryRaw<Array<{ count: number }>>`
                INSERT INTO "rate_limit_windows" ("bucket", "windowStart", "count")
                VALUES (${bucket}, ${windowStart}, 1)
                ON CONFLICT ("bucket") DO UPDATE SET
                    "count" = CASE
                        WHEN "rate_limit_windows"."windowStart" <= ${expireBefore} THEN 1
                        ELSE "rate_limit_windows"."count" + 1
                    END,
                    "windowStart" = CASE
                        WHEN "rate_limit_windows"."windowStart" <= ${expireBefore} THEN ${windowStart}
                        ELSE "rate_limit_windows"."windowStart"
                    END
                RETURNING "count"
            `;

            return rows[0]?.count ?? 1;
        },
    };
}

let defaultStore: RateLimitStore | null = null;

export function getRateLimitStore(): RateLimitStore {
    if (!defaultStore) defaultStore = createPostgresRateLimitStore();
    return defaultStore;
}

/** Test-only: replace the process-wide store. */
export function setRateLimitStoreForTests(store: RateLimitStore | null) {
    defaultStore = store;
}

export function clientIpFromRequest(req: Request): string {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
        const first = forwarded.split(",")[0]?.trim();
        if (first) return first.slice(0, 64);
    }
    const realIp = req.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp.slice(0, 64);
    return "unknown";
}

/**
 * Bucket identity. `userId` must be the authenticated TOLG user id from the
 * session — never a body/query target id.
 */
export function rateLimitBucket(policy: RateLimitPolicy, userId?: string | null, req?: Request): string {
    if (userId) return `${policy}:user:${userId}`;
    const ip = req ? clientIpFromRequest(req) : "unknown";
    return `${policy}:ip:${ip}`;
}

export async function consumeRateLimit(
    policy: RateLimitPolicy,
    identity: { userId?: string | null; req?: Request },
    store: RateLimitStore = getRateLimitStore(),
    now = Date.now()
): Promise<{ allowed: boolean; count: number; limit: number }> {
    const rule = RATE_LIMIT_RULES[policy];
    const bucket = rateLimitBucket(policy, identity.userId, identity.req);
    const count = await store.consume(bucket, rule.windowMs, now);
    return {
        allowed: count <= rule.limit,
        count,
        limit: rule.limit,
    };
}

const RATE_LIMIT_MESSAGE = "Too many requests. Try again shortly.";

export function rateLimitResponse(windowMs: number): NextResponse {
    const res = NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
    res.headers.set("Retry-After", String(Math.ceil(windowMs / 1000)));
    return res;
}

export async function enforceRateLimit(
    req: Request,
    policy: RateLimitPolicy,
    userId?: string | null
): Promise<NextResponse | null> {
    const result = await consumeRateLimit(policy, { userId, req });
    if (result.allowed) return null;
    return rateLimitResponse(RATE_LIMIT_RULES[policy].windowMs);
}
