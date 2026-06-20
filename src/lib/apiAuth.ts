import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserDeactivationStatusByClerkId, isInactiveAccount } from "@/lib/userDeactivation";
import { isClientViewMode, parseTeamCoachId } from "@/lib/roles";

export { defaultHomeForRole, isClientViewMode, parseTeamCoachId } from "@/lib/roles";

export async function requireAuthUser(req?: Request): Promise<
    | { user: User; error: null }
    | { user: null; error: NextResponse }
> {
    const { userId } = await auth();
    if (!userId) {
        return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
        return { user: null, error: NextResponse.json({ error: "User not found" }, { status: 404 }) };
    }

    if (await getUserDeactivationStatusByClerkId(userId)) {
        return { user: null, error: NextResponse.json({ error: "Account deactivated" }, { status: 403 }) };
    }

    return { user, error: null };
}

export function canLogWorkouts(user: User, req: Request): boolean {
    if (user.role === "FREE" || user.role === "PREMIUM") return true;
    if ((user.role === "COACH" || user.role === "SUPER_ADMIN") && isClientViewMode(req)) return true;
    return false;
}

export async function workoutAssignedToUser(userId: string, workoutId: string): Promise<boolean> {
    const link = await prisma.userPlan.findFirst({
        where: {
            userId,
            plan: { weeks: { some: { workouts: { some: { id: workoutId } } } } },
        },
        select: { id: true },
    });
    return !!link;
}

export async function canAccessClient(
    actor: Pick<User, "id" | "role">,
    clientId: string
): Promise<boolean> {
    if (actor.role === "SUPER_ADMIN") return true;
    if (actor.role !== "COACH") return false;
    const client = await prisma.user.findUnique({
        where: { id: clientId },
        select: { coachId: true },
    });
    return client?.coachId === actor.id;
}

/** Block coach mutations when the athlete account is deleted or deactivated. */
export async function requireCoachCanEditClient(
    actor: Pick<User, "id" | "role">,
    clientId: string
): Promise<{ error: null } | { error: NextResponse }> {
    if (!(await canAccessClient(actor, clientId))) {
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }

    const client = await prisma.user.findUnique({
        where: { id: clientId },
        select: { email: true, isDeleted: true, isDeactivated: true },
    });
    if (!client) {
        return { error: NextResponse.json({ error: "Client not found" }, { status: 404 }) };
    }
    if (isInactiveAccount(client)) {
        return {
            error: NextResponse.json(
                { error: "This account is inactive and cannot be edited" },
                { status: 403 }
            ),
        };
    }

    return { error: null };
}

export async function canDirectMessage(
    actor: Pick<User, "id" | "role" | "coachId">,
    otherUserId: string
): Promise<boolean> {
    if (actor.id === otherUserId) return false;
    if (actor.role === "SUPER_ADMIN") return true;

    const other = await prisma.user.findUnique({
        where: { id: otherUserId },
        select: { id: true, coachId: true, role: true },
    });
    if (!other) return false;

    if (actor.coachId === other.id) return true;
    if (other.coachId === actor.id) return true;
    return false;
}

export async function canAccessTeamChat(
    actor: Pick<User, "id" | "role" | "coachId">,
    teamCoachId: string
): Promise<boolean> {
    if (actor.role === "SUPER_ADMIN") return true;
    if (actor.id === teamCoachId) return true;
    return actor.coachId === teamCoachId;
}

export async function isMessageParticipant(
    actor: Pick<User, "id" | "role" | "coachId">,
    message: { senderId: string; receiverId: string | null; isGeneral: boolean }
): Promise<boolean> {
    if (message.isGeneral) return true;
    if (message.senderId === actor.id) return true;
    if (message.receiverId === actor.id) return true;

    const teamCoachId = parseTeamCoachId(message.receiverId);
    if (teamCoachId) {
        return canAccessTeamChat(actor, teamCoachId);
    }

    const peerId = message.senderId === actor.id ? message.receiverId : message.senderId;
    if (peerId) return canDirectMessage(actor, peerId);
    return false;
}
