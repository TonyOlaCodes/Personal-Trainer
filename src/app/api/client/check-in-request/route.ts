import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/apiAuth";
import {
    clearCheckInRequest,
    getPriorityActiveCheckInRequestForClient,
    type CheckInRequestRow,
} from "@/lib/checkInRequests";
import {
    getUserCheckInSchedule,
    hasCheckInForOutstandingPeriod,
} from "@/lib/checkInSchedule";
import { getClientAttentionActions } from "@/lib/coachAttentionActions";
import {
    isCoachClientCheckInAttentionNeeded,
    resolveCoachClientCheckInDueState,
} from "@/lib/coachOverdueCheckIns";
import { canAccessCheckIns, isClientRole } from "@/lib/roles";
import { withResolvedAvatar } from "@/lib/uploadUrls";

async function isRequestStillOutstanding(
    userId: string,
    lastActiveAt: Date | null | undefined,
    submittedWeeks: number[],
    submittedPeriodKeys: Array<string | null> = [],
    request: CheckInRequestRow
) {
    const schedule = await getUserCheckInSchedule(userId);
    const clientActions = await getClientAttentionActions(userId);
    const dueState = resolveCoachClientCheckInDueState(
        schedule,
        clientActions,
        userId,
        lastActiveAt
    );
    const periodWeek = dueState.outstandingWeekNumber ?? dueState.weekNumber;
    const hasSubmission = hasCheckInForOutstandingPeriod(dueState, submittedWeeks, submittedPeriodKeys);
    const stillNeeded = isCoachClientCheckInAttentionNeeded(dueState, hasSubmission);

    return {
        dueState,
        valid: stillNeeded && request.weekNumber === periodWeek,
    };
}

/** Active coach-requested check-in reminder for the signed-in client (one prioritized). */
export async function GET(req: Request) {
    const authResult = await requireActiveUser(req);
    if (authResult.error) return authResult.error;

    const user = await prisma.user.findUnique({
        where: { id: authResult.user.id },
        select: {
            id: true,
            role: true,
            coachId: true,
            lastActiveAt: true,
            checkIns: {
                where: {
                    createdAt: { gte: new Date(Date.now() - 90 * 86400000) },
                },
                select: { weekNumber: true, periodDueDateKey: true },
            },
        },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (!isClientRole(user.role) || !canAccessCheckIns(user.role, user.coachId)) {
        return NextResponse.json({ request: null });
    }

    const submittedWeeks = user.checkIns.map((c) => c.weekNumber);
    const submittedPeriodKeys = user.checkIns.map((c) => c.periodDueDateKey ?? null);
    let attempts = 0;
    let active = await getPriorityActiveCheckInRequestForClient(user.id);
    let dueState = null as Awaited<ReturnType<typeof isRequestStillOutstanding>>["dueState"] | null;

    while (active && attempts < 5) {
        attempts += 1;
        const check = await isRequestStillOutstanding(
            user.id,
            user.lastActiveAt,
            submittedWeeks,
            submittedPeriodKeys,
            active
        );
        dueState = check.dueState;
        if (check.valid) break;
        await clearCheckInRequest(user.id, active.weekNumber);
        active = await getPriorityActiveCheckInRequestForClient(user.id);
    }

    if (!active || !dueState) {
        return NextResponse.json({ request: null });
    }

    const coach = await prisma.user.findUnique({
        where: { id: active.coachId },
        select: { id: true, name: true, avatarUrl: true },
    });

    const coachName = coach?.name?.trim() || "Your coach";
    const isOverdue = dueState.isOverdue;

    return NextResponse.json({
        request: {
            id: active.id,
            clientId: active.clientId,
            weekNumber: active.weekNumber,
            periodDueDateKey: active.periodDueDateKey,
            requestedAt: active.requestedAt.toISOString(),
            lastRequestedAt: active.lastRequestedAt.toISOString(),
            isOverdue,
            daysOverdue: dueState.daysOverdue,
            checkInHref: `/checkins?week=${active.weekNumber}&start=1`,
            coach: withResolvedAvatar({
                id: coach?.id ?? active.coachId,
                name: coachName,
                avatarUrl: coach?.avatarUrl ?? null,
            }),
            title: "CHECK-IN REQUESTED",
            body: `${coachName} has requested that you complete your check-in.`,
            statusLine: isOverdue
                ? "Your check-in is currently overdue."
                : "Your check-in is due today.",
        },
    });
}
