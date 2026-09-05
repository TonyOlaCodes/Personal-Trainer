import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessClient, canLogWorkouts } from "@/lib/apiAuth";
import { getNickname, pickDisplayName } from "@/lib/userNicknames";

export type PlanHistoryAssignment = {
    userId: string;
    isActive: boolean;
    coachId: string | null;
    isDeleted: boolean;
    isDeactivated: boolean;
};

export type PlanHistoryPick =
    | { kind: "user"; userId: string }
    | { kind: "unassigned" }
    | { kind: "forbidden" };

export type ResolvedHistorySubject =
    | { status: "ok"; userId: string; name: string; isOtherUser: boolean }
    | { status: "unassigned" }
    | { status: "forbidden"; error: NextResponse };

export function actorCanReadHistoryUser(
    actorId: string,
    actorRole: string,
    targetUserId: string,
    targetCoachId: string | null
): boolean {
    if (targetUserId === actorId) return true;
    if (actorRole === "SUPER_ADMIN") return true;
    return targetCoachId === actorId;
}

/**
 * Who exercise history belongs to for a plan. Assignment wins over the
 * logged-in viewer and over the original plan creator / copy source.
 */
export function pickPlanHistoryAssignee(input: {
    actorId: string;
    actorRole: string;
    canLogWorkouts: boolean;
    preferredClientId?: string | null;
    assignments: PlanHistoryAssignment[];
}): PlanHistoryPick {
    const preferred = input.preferredClientId?.trim() || null;
    const usable = input.assignments.filter((row) => !row.isDeleted && !row.isDeactivated);
    const active = usable.filter((row) => row.isActive);
    const pool = active.length > 0 ? active : usable;
    const readable = pool.filter((row) =>
        actorCanReadHistoryUser(input.actorId, input.actorRole, row.userId, row.coachId)
    );

    if (!preferred || preferred === input.actorId) {
        const self = pool.find((row) => row.userId === input.actorId);
        if (self) return { kind: "user", userId: input.actorId };
    }

    if (preferred) {
        const assignedPreferred = pool.find((row) => row.userId === preferred);
        if (assignedPreferred) {
            if (!actorCanReadHistoryUser(
                input.actorId,
                input.actorRole,
                assignedPreferred.userId,
                assignedPreferred.coachId
            )) {
                return { kind: "forbidden" };
            }
            return { kind: "user", userId: assignedPreferred.userId };
        }
    }

    if (readable.length === 1) {
        return { kind: "user", userId: readable[0].userId };
    }

    if (readable.length > 1) {
        return { kind: "unassigned" };
    }

    if (pool.length > 0) {
        return { kind: "forbidden" };
    }

    if (preferred) {
        return { kind: "user", userId: preferred };
    }

    if (input.canLogWorkouts) {
        return { kind: "user", userId: input.actorId };
    }

    return { kind: "unassigned" };
}

export function pickHistorySubjectWithoutPlan(input: {
    actorId: string;
    canLogWorkouts: boolean;
    requestedClientId?: string | null;
}): PlanHistoryPick {
    const requested = input.requestedClientId?.trim() || null;
    if (requested && requested !== input.actorId) {
        return { kind: "user", userId: requested };
    }
    if (input.canLogWorkouts) {
        return { kind: "user", userId: input.actorId };
    }
    return { kind: "unassigned" };
}

async function subjectForUserId(
    actor: Pick<User, "id" | "role" | "name" | "email">,
    userId: string
): Promise<ResolvedHistorySubject> {
    if (userId !== actor.id && actor.role !== "SUPER_ADMIN") {
        const gateOk = await canAccessClient(actor, userId);
        if (!gateOk) {
            return {
                status: "forbidden",
                error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
            };
        }
    }

    const target = userId === actor.id
        ? { name: actor.name, email: actor.email }
        : await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true },
        });

    if (!target && userId !== actor.id) {
        return {
            status: "forbidden",
            error: NextResponse.json({ error: "Client not found" }, { status: 404 }),
        };
    }

    const nickname = userId === actor.id ? null : await getNickname(actor.id, userId);
    const name = pickDisplayName(
        target?.name,
        target?.email,
        nickname,
        userId === actor.id ? "You" : "Client"
    );

    return {
        status: "ok",
        userId,
        name,
        isOtherUser: userId !== actor.id,
    };
}

export async function resolvePlanHistorySubject(
    actor: User,
    planId: string,
    preferredClientId?: string | null
): Promise<ResolvedHistorySubject> {
    const rows = await prisma.userPlan.findMany({
        where: { planId },
        select: {
            userId: true,
            isActive: true,
            user: {
                select: {
                    coachId: true,
                    isDeleted: true,
                    isDeactivated: true,
                },
            },
        },
    });

    const pick = pickPlanHistoryAssignee({
        actorId: actor.id,
        actorRole: actor.role,
        canLogWorkouts: canLogWorkouts(actor),
        preferredClientId,
        assignments: rows.map((row) => ({
            userId: row.userId,
            isActive: row.isActive,
            coachId: row.user.coachId,
            isDeleted: row.user.isDeleted,
            isDeactivated: row.user.isDeactivated,
        })),
    });

    if (pick.kind === "unassigned") return { status: "unassigned" };
    if (pick.kind === "forbidden") {
        return {
            status: "forbidden",
            error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        };
    }
    return subjectForUserId(actor, pick.userId);
}

/** Authoritative history subject for the inspector. Never falls back to a coach. */
export async function resolveExerciseHistorySubject(
    actor: User,
    options: { planId?: string | null; clientId?: string | null }
): Promise<ResolvedHistorySubject> {
    const planId = options.planId?.trim() || null;
    const clientId = options.clientId?.trim() || null;

    if (planId) {
        return resolvePlanHistorySubject(actor, planId, clientId);
    }

    const pick = pickHistorySubjectWithoutPlan({
        actorId: actor.id,
        canLogWorkouts: canLogWorkouts(actor),
        requestedClientId: clientId,
    });

    if (pick.kind === "unassigned") return { status: "unassigned" };
    if (pick.kind === "forbidden") {
        return {
            status: "forbidden",
            error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        };
    }
    return subjectForUserId(actor, pick.userId);
}

export type PlanHistorySubjectPayload =
    | { kind: "assigned"; userId: string; name: string; isOtherUser: boolean }
    | { kind: "unassigned" };

export function toPlanHistorySubjectPayload(
    subject: ResolvedHistorySubject
): PlanHistorySubjectPayload {
    if (subject.status === "ok") {
        return {
            kind: "assigned",
            userId: subject.userId,
            name: subject.name,
            isOtherUser: subject.isOtherUser,
        };
    }
    return { kind: "unassigned" };
}
