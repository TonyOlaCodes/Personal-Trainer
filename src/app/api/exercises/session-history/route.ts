import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, resolveWorkoutLogReadUserId } from "@/lib/apiAuth";
import {
    DEFAULT_EXERCISE_HISTORY_SESSIONS,
    loadExerciseSessionHistoryBatch,
} from "@/lib/exerciseSessionHistory";
import {
    ensureExerciseTrackingSchema,
    resolveTrackingSchema,
    strengthFallback,
} from "@/lib/exerciseTracking";
import type { UnitSystem } from "@/lib/units";

/** Cap so one request can't fan out into an unbounded number of lookups. */
const MAX_NAMES = 40;

/**
 * Session-by-session completed history for one or more exercises.
 *
 * Powers the coach Exercise History Inspector (plan editor, Edit Session and the
 * client profile progression section). Kept separate from `/api/exercises/history`
 * — which stays lean for the live logging screen — but both read the same
 * underlying completed-workout data.
 *
 * Accepts repeated or comma-separated `name` params so a plan editor can resolve
 * every exercise on the day in a single history scan.
 */
export async function GET(req: Request) {
    const authResult = await requireActiveUser(req);
    if (authResult.error) return authResult.error;
    const actor = authResult.user;

    const url = new URL(req.url);
    // Repeated `name` params only — exercise names are free text and may contain commas.
    const names = url.searchParams
        .getAll("name")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .slice(0, MAX_NAMES);

    if (names.length === 0) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const clientId = url.searchParams.get("clientId");
    const excludeLogId = url.searchParams.get("excludeLogId") || undefined;
    const requestedLimit = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.trunc(requestedLimit), 100)
        : DEFAULT_EXERCISE_HISTORY_SESSIONS;

    const readTarget = await resolveWorkoutLogReadUserId(actor, clientId);
    if (readTarget.error) return readTarget.error;

    try {
        await ensureExerciseTrackingSchema();

        const [results, target] = await Promise.all([
            loadExerciseSessionHistoryBatch(readTarget.targetUserId, names, {
                limit,
                excludeLogId,
            }),
            prisma.user.findUnique({
                where: { id: readTarget.targetUserId },
                select: { unitSystem: true },
            }),
        ]);

        // `resolveTrackingSchema` reads the dictionary itself; muscle group is only
        // consulted for names it does not know, where a lookup would find nothing anyway.
        const exercises = await Promise.all(
            results.map(async (result) => ({
                /** Echoed back so the caller can match responses without relying on order. */
                requested: result.requested,
                key: result.key,
                name: result.name,
                sessions: result.sessions,
                hasMore: result.hasMore,
                trackingSchema: result.key
                    ? await resolveTrackingSchema(result.name)
                    : strengthFallback(),
            }))
        );

        return NextResponse.json({
            exercises,
            unitSystem: (target?.unitSystem ?? "METRIC") as UnitSystem,
        });
    } catch (error) {
        console.error("[GET /api/exercises/session-history]", error);
        return NextResponse.json({ error: "Could not load exercise history" }, { status: 500 });
    }
}
