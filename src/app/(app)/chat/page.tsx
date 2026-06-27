import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDirectMessageActivity } from "@/lib/chatActivity";
import { getUnreadCountsByPeer } from "@/lib/chatUnread";
import { getCoachClientFilterFlags } from "@/lib/chatConversationMeta";
import { withResolvedAvatar } from "@/lib/uploadUrls";
import { dedupeCoachPlansByName } from "@/lib/coachPlans";
import { isInactiveAccount } from "@/lib/userDeactivation";
import { ChatClient } from "./ChatClient";

export const metadata = { title: "Chat" };

export default async function ChatPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) redirect("/sign-in");

    let conversations: {
        userId: string;
        name: string;
        email?: string;
        role: string;
        avatarUrl: string | null;
        isDeleted?: boolean;
        isDeactivated?: boolean;
        lastMessageAt?: string | null;
        lastActiveAt?: string | null;
        checkInDue?: boolean;
        missedWorkout?: boolean;
    }[] = [];

    if (user.role === "PREMIUM") {
        if (user.coachId) {
            const coach = await prisma.user.findUnique({
                where: { id: user.coachId },
                select: {
                    id: true, name: true, email: true, role: true, avatarUrl: true,
                    isDeleted: true, isDeactivated: true, deletedName: true, lastActiveAt: true,
                },
            });
            if (coach && !isInactiveAccount(coach)) {
                conversations = [withResolvedAvatar({
                    userId: coach.id,
                    name: coach.isDeleted ? (coach.deletedName ?? "Deleted Coach") : (coach.name ?? "Coach"),
                    email: coach.email,
                    role: coach.role,
                    avatarUrl: coach.isDeleted ? null : coach.avatarUrl,
                    isDeleted: coach.isDeleted,
                    isDeactivated: coach.isDeactivated,
                    lastActiveAt: coach.lastActiveAt?.toISOString() ?? null,
                })];
            }
        }
    } else if (user.role === "SUPER_ADMIN") {
        const users = await prisma.user.findMany({
            where: { id: { not: user.id }, isDeleted: false, isDeactivated: false },
            select: {
                id: true, name: true, email: true, role: true, avatarUrl: true,
                isDeleted: true, isDeactivated: true, deletedName: true, lastActiveAt: true,
            },
            orderBy: [{ name: "asc" }],
        });
        conversations = users.map((c) => withResolvedAvatar({
            userId: c.id,
            name: c.isDeleted ? (c.deletedName ?? "Deleted User") : (c.name ?? "User"),
            email: c.email,
            role: c.role,
            avatarUrl: c.isDeleted ? null : c.avatarUrl,
            isDeleted: c.isDeleted,
            isDeactivated: c.isDeactivated,
            lastActiveAt: c.lastActiveAt?.toISOString() ?? null,
        }));
    } else if (user.role === "COACH") {
        const clients = await prisma.user.findMany({
            where: { coachId: user.id, isDeleted: false, isDeactivated: false },
            select: {
                id: true, name: true, email: true, role: true, avatarUrl: true,
                isDeleted: true, isDeactivated: true, deletedName: true, lastActiveAt: true,
            },
        });
        conversations = clients.map((c) => withResolvedAvatar({
            userId: c.id,
            name: c.isDeleted ? (c.deletedName ?? "Deleted Athlete") : (c.name ?? "Client"),
            email: c.email,
            role: c.role,
            avatarUrl: c.isDeleted ? null : c.avatarUrl,
            isDeleted: c.isDeleted,
            isDeactivated: c.isDeactivated,
            lastActiveAt: c.lastActiveAt?.toISOString() ?? null,
        }));
    }

    let coachPlans: { id: string; name: string; type?: string }[] = [];
    if (user.role === "COACH" || user.role === "SUPER_ADMIN") {
        const rawPlans = await prisma.plan.findMany({
            where: user.role === "COACH" ? { creatorId: user.id } : {},
            select: { id: true, name: true, type: true, updatedAt: true, creatorId: true },
            orderBy: { updatedAt: "desc" },
        });
        coachPlans = dedupeCoachPlansByName(rawPlans).map(({ id, name, type }) => ({ id, name, type }));
    }

    let initialUnread: Record<string, number> = {};
    if (conversations.length > 0 && user.role !== "FREE") {
        const peerIds = conversations.map((conversation) => conversation.userId);
        const [activity, unread] = await Promise.all([
            getDirectMessageActivity(user.id, peerIds),
            getUnreadCountsByPeer(user.id, peerIds),
        ]);
        initialUnread = unread;
        conversations = conversations.map((conversation) => ({
            ...conversation,
            lastMessageAt: activity[conversation.userId] ?? null,
        }));

        if (user.role === "COACH") {
            const filterFlags = await getCoachClientFilterFlags(peerIds);
            conversations = conversations.map((conversation) => ({
                ...conversation,
                checkInDue: filterFlags[conversation.userId]?.checkInDue ?? false,
                missedWorkout: filterFlags[conversation.userId]?.missedWorkout ?? false,
            }));
        }
    }

    return (
        <div className="-mb-20 h-0 overflow-hidden md:mb-0 md:h-auto md:overflow-visible">
            <ChatClient
                currentUserId={user.id}
                currentUserRole={user.role}
                conversations={conversations}
                canUseDirectChat={user.role !== "FREE"}
                coachPlans={coachPlans}
                initialUnread={initialUnread}
            />
        </div>
    );
}
