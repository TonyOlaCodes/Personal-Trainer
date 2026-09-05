import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoachCanEditClient, requireCoachUser } from "@/lib/apiAuth";
import { enforceRateLimit } from "@/lib/rateLimit";
import {
    CHECK_IN_REQUEST_COOLDOWN_MS,
    CHECK_IN_REQUEST_FAILED_MESSAGE,
    upsertCheckInRequest,
} from "@/lib/checkInRequests";
import { notifyClientOfCheckInRequest } from "@/lib/notifications";
import {
    canonicalPeriodDueDateKey,
    getUserCheckInSchedule,
    hasCheckInForOutstandingPeriod,
} from "@/lib/checkInSchedule";
import { getClientAttentionActions } from "@/lib/coachAttentionActions";
import {
    isCoachClientCheckInAttentionNeeded,
    resolveCoachClientCheckInDueState,
} from "@/lib/coachOverdueCheckIns";

const schema = z.object({
    clientId: z.string().min(1),
    weekNumber: z.number().int().positive(),
});

export async function POST(req: Request) {
    const authResult = await requireCoachUser(req);
    if (authResult.error) return authResult.error;
    const coach = authResult.user;
    const limited = await enforceRateLimit(req, "checkInRequest", coach.id);
    if (limited) return limited;

    try {
        const parsed = schema.parse(await req.json());
        const authz = await requireCoachCanEditClient(coach, parsed.clientId);
        if (authz.error) return authz.error;

        const client = await prisma.user.findUnique({
            where: { id: parsed.clientId },
            select: {
                id: true,
                checkIns: {
                    where: {
                        createdAt: { gte: new Date(Date.now() - 90 * 86400000) },
                    },
                    select: { weekNumber: true, periodDueDateKey: true },
                },
                lastActiveAt: true,
            },
        });
        if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

        const schedule = await getUserCheckInSchedule(client.id);
        const clientActions = await getClientAttentionActions(client.id);
        const dueState = resolveCoachClientCheckInDueState(
            schedule,
            clientActions,
            client.id,
            client.lastActiveAt
        );
        const periodWeek = dueState.outstandingWeekNumber ?? dueState.weekNumber;
        if (periodWeek !== parsed.weekNumber) {
            return NextResponse.json(
                { error: "That check-in period is not currently overdue or due" },
                { status: 400 }
            );
        }

        const hasSubmission = hasCheckInForOutstandingPeriod(
            dueState,
            client.checkIns.map((c) => c.weekNumber),
            client.checkIns.map((c) => c.periodDueDateKey)
        );
        if (!isCoachClientCheckInAttentionNeeded(dueState, hasSubmission)) {
            return NextResponse.json(
                { error: "Client has already submitted this check-in" },
                { status: 400 }
            );
        }

        const periodDueDateKey = canonicalPeriodDueDateKey(dueState.currentPeriodDueDate);

        const result = await upsertCheckInRequest({
            coachId: coach.id,
            clientId: client.id,
            weekNumber: parsed.weekNumber,
            periodDueDateKey,
            enforceCooldown: true,
        });

        if (result.throttled) {
            return NextResponse.json({
                ok: true,
                throttled: true,
                message: "Check-in already requested",
                request: {
                    id: result.request.id,
                    clientId: result.request.clientId,
                    weekNumber: result.request.weekNumber,
                    requestedAt: result.request.requestedAt.toISOString(),
                    lastRequestedAt: result.request.lastRequestedAt.toISOString(),
                },
                cooldownMs: CHECK_IN_REQUEST_COOLDOWN_MS,
            });
        }

        await notifyClientOfCheckInRequest({
            clientUserId: client.id,
            coachId: coach.id,
            coachName: coach.name,
            weekNumber: parsed.weekNumber,
        });

        return NextResponse.json({
            ok: true,
            throttled: false,
            message: "Check-in requested",
            request: {
                id: result.request.id,
                clientId: result.request.clientId,
                weekNumber: result.request.weekNumber,
                requestedAt: result.request.requestedAt.toISOString(),
                lastRequestedAt: result.request.lastRequestedAt.toISOString(),
            },
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            console.error("[POST /api/coach/check-in-requests] validation", err.issues);
            return NextResponse.json({ error: CHECK_IN_REQUEST_FAILED_MESSAGE }, { status: 400 });
        }
        console.error("[POST /api/coach/check-in-requests]", err);
        return NextResponse.json({ error: CHECK_IN_REQUEST_FAILED_MESSAGE }, { status: 500 });
    }
}
