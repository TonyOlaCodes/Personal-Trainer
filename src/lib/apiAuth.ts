import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { anonymizeDeletedUserAccount } from "@/lib/accountDeletion";
import { getUserDeactivationStatusByClerkId, isInactiveAccount } from "@/lib/userDeactivation";
import { isClientRole, isCoachRole, parseTeamCoachId } from "@/lib/roles";
import { canViewFullProfile, canViewUserProfile } from "@/lib/userProfile";
import { ensureAccessRequestColumns } from "@/lib/accessRequest";
import { getUserProfilePrivacy } from "@/lib/profilePrivacy";
import { resolveActiveUserGate } from "@/lib/apiAuthPolicy";

export { defaultHomeForRole, isCoachRole, isClientRole, parseTeamCoachId } from "@/lib/roles";

/** Ensures a Prisma user row exists for the signed-in Clerk account (e.g. before onboarding completes). */
export async function bootstrapClerkUser(clerkId: string): Promise<User | null> {
    const existing = await prisma.user.findUnique({ where: { clerkId } });
    if (existing) return existing;

    const clerkUser = await currentUser();
    if (!clerkUser || clerkUser.id !== clerkId) return null;

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) return null;

    if (email !== "unknown@example.com") {
        const staleEmailUser = await prisma.user.findUnique({ where: { email } });
        if (staleEmailUser && staleEmailUser.clerkId !== clerkId) {
            await anonymizeDeletedUserAccount(prisma, staleEmailUser);
        }
    }

    const name = clerkUser.firstName
        ? `${clerkUser.firstName} ${clerkUser.lastName ?? ""}`.trim()
        : null;

    return prisma.user.create({
        data: {
            clerkId,
            email,
            name,
            avatarUrl: clerkUser.imageUrl,
            role: "FREE",
        },
    });
}

export async function requireAuthUser(req?: Request): Promise<
    | { user: User; error: null }
    | { user: null; error: NextResponse }
> {
    const { userId } = await auth();
    if (!userId) {
        const sessionGate = resolveActiveUserGate({ hasClerkSession: false, user: null });
        if (!sessionGate.ok) {
            return { user: null, error: NextResponse.json({ error: sessionGate.error }, { status: sessionGate.status }) };
        }
        return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    let user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
        user = await bootstrapClerkUser(userId);
    }

    const userGate = resolveActiveUserGate({
        hasClerkSession: true,
        user: user
            ? {
                email: user.email,
                isDeactivated: user.isDeactivated || (await getUserDeactivationStatusByClerkId(userId)),
                isDeleted: user.isDeleted,
            }
            : null,
    });
    if (!userGate.ok) {
        return { user: null, error: NextResponse.json({ error: userGate.error }, { status: userGate.status }) };
    }

    return { user: user!, error: null };
}

/** Authenticated Clerk session + active TOLG user. Preferred name for new routes. */
export const requireActiveUser = requireAuthUser;

export async function requireCoachUser(req?: Request): Promise<
    | { user: User; error: null }
    | { user: null; error: NextResponse }
> {
    const authResult = await requireActiveUser(req);
    if (authResult.error) return authResult;
    if (!isCoachRole(authResult.user.role)) {
        return { user: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return authResult;
}

export async function requireSuperAdmin(req?: Request): Promise<
    | { user: User; error: null }
    | { user: null; error: NextResponse }
> {
    const authResult = await requireActiveUser(req);
    if (authResult.error) return authResult;
    if (authResult.user.role !== "SUPER_ADMIN") {
        return { user: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return authResult;
}

/** Vercel cron / system routes. Never use requireActiveUser here. */
export { authorizeCronRequest } from "@/lib/cronAuth";

export function cronUnauthorized(): NextResponse {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function canLogWorkouts(user: User): boolean {
    return user.role === "FREE" || user.role === "PREMIUM" || user.role === "GENERAL_PREMIUM";
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

/** Who a workout log write applies to — self, or a coach's client when clientId is provided. */
export async function resolveWorkoutLogSubjectUserId(
    actor: User,
    clientId?: string | null
): Promise<{ subjectUserId: string; error: null } | { subjectUserId: null; error: NextResponse }> {
    if (!clientId || clientId === actor.id) {
        if (!canLogWorkouts(actor)) {
            return {
                subjectUserId: null,
                error: NextResponse.json({ error: "Coaches cannot log workouts" }, { status: 403 }),
            };
        }
        return { subjectUserId: actor.id, error: null };
    }

    if (actor.role === "SUPER_ADMIN") {
        return { subjectUserId: clientId, error: null };
    }

    const gate = await requireCoachCanEditClient(actor, clientId);
    if (gate.error) {
        return { subjectUserId: null, error: gate.error };
    }

    return { subjectUserId: clientId, error: null };
}

export async function resolveWorkoutLogReadUserId(
    actor: User,
    requestedUserId?: string | null
): Promise<{ targetUserId: string; error: null } | { targetUserId: null; error: NextResponse }> {
    if (!requestedUserId || requestedUserId === actor.id) {
        return { targetUserId: actor.id, error: null };
    }

    if (actor.role === "SUPER_ADMIN") {
        return { targetUserId: requestedUserId, error: null };
    }

    const gate = await requireCoachCanEditClient(actor, requestedUserId);
    if (gate.error) {
        return { targetUserId: null, error: gate.error };
    }

    return { targetUserId: requestedUserId, error: null };
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

    if (actor.role === "SUPER_ADMIN") {
        await ensureAccessRequestColumns();
        const other = await prisma.user.findUnique({
            where: { id: otherUserId },
            select: { role: true, accessLiaisonId: true },
        });
        if (other?.role === "FREE" && other.accessLiaisonId && other.accessLiaisonId !== actor.id) {
            return false;
        }
        return true;
    }

    const other = await prisma.user.findUnique({
        where: { id: otherUserId },
        select: {
            id: true,
            coachId: true,
            role: true,
            isDeleted: true,
            isDeactivated: true,
            email: true,
        },
    });
    if (!other || isInactiveAccount(other)) return false;

    // Assigned coach ↔ client (always allowed)
    if (actor.coachId === other.id) return true;
    if (other.coachId === actor.id) return true;

    if (actor.role === "FREE" && other.role === "SUPER_ADMIN") {
        await ensureAccessRequestColumns();
        const actorRow = await prisma.user.findUnique({
            where: { id: actor.id },
            select: { accessLiaisonId: true },
        });
        if (actorRow?.accessLiaisonId) {
            return other.id === actorRow.accessLiaisonId;
        }
        return true;
    }

    // Social DMs honour the recipient's allowMessages setting.
    const recipientPrivacy = await getUserProfilePrivacy(otherUserId);
    if (!recipientPrivacy.allowMessages) return false;

    // Social messaging from public profiles (free and other client roles)
    if (!isClientRole(actor.role) || !isClientRole(other.role)) return false;
    if (!(await canViewUserProfile({ id: actor.id, role: actor.role }, otherUserId))) return false;

    return canViewFullProfile({ id: actor.id, role: actor.role }, otherUserId);
}

/** Read an existing 1:1 thread even when the peer has since disabled new messages. */
export async function canReadDirectThread(
    actor: Pick<User, "id" | "role" | "coachId">,
    otherUserId: string
): Promise<boolean> {
    if (await canDirectMessage(actor, otherUserId)) return true;

    const existing = await prisma.message.findFirst({
        where: {
            isGeneral: false,
            OR: [
                { senderId: actor.id, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: actor.id },
            ],
        },
        select: { id: true },
    });
    return !!existing;
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
