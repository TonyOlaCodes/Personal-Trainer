import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDirectMessageActivity, getDirectMessagePeerIds } from "@/lib/chatActivity";
import { getUnreadCountsByPeer } from "@/lib/chatUnread";
import { getCoachClientFilterFlags } from "@/lib/chatConversationMeta";
import { withResolvedAvatar } from "@/lib/uploadUrls";
import { dedupeCoachPlansByName } from "@/lib/coachPlans";
import { isInactiveAccount } from "@/lib/userDeactivation";
import { isClientRole, isCoachRole } from "@/lib/roles";
import { getFreeUserAccessLiaisonId } from "@/lib/accessRequest";
import { loadNicknameMap, pickDisplayName } from "@/lib/userNicknames";
import { ChatClient } from "./ChatClient";

export const metadata = { title: "Chat" };

async function loadPeerConversations(peerIds: string[]) {
    if (peerIds.length === 0) return [];

    const peers = await prisma.user.findMany({
        where: {
            id: { in: peerIds },
            isDeleted: false,
            isDeactivated: false,
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
            isDeleted: true,
            isDeactivated: true,
            deletedName: true,
            lastActiveAt: true,
        },
    });

    const peerById = new Map(peers.map((peer) => [peer.id, peer]));
    return peerIds
        .map((peerId) => peerById.get(peerId))
        .filter((peer): peer is NonNullable<typeof peer> => Boolean(peer))
        .map((peer) => withResolvedAvatar({
            userId: peer.id,
            name: peer.name ?? "Athlete",
            email: peer.email,
            role: peer.role,
            avatarUrl: peer.avatarUrl,
            isDeleted: peer.isDeleted,
            isDeactivated: peer.isDeactivated,
            lastActiveAt: peer.lastActiveAt?.toISOString() ?? null,
        }));
}

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
        isCoachClient?: boolean;
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
        const socialPeerIds = (await getDirectMessagePeerIds(user.id))
            .filter((peerId) => peerId !== user.coachId);
        const socialConversations = await loadPeerConversations(socialPeerIds);
        conversations = [...conversations, ...socialConversations];
    } else if (user.role === "SUPER_ADMIN") {
        const users = await prisma.user.findMany({
            where: { id: { not: user.id }, isDeleted: false, isDeactivated: false },
            select: {
                id: true, name: true, email: true, role: true, avatarUrl: true,
                coachId: true, isDeleted: true, isDeactivated: true, deletedName: true, lastActiveAt: true,
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
            isCoachClient: c.coachId === user.id,
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
            isCoachClient: true,
        }));
    } else if (isClientRole(user.role)) {
        const peerIds = await getDirectMessagePeerIds(user.id);
        const liaisonId = user.role === "FREE" ? await getFreeUserAccessLiaisonId(user.id) : null;
        const mergedPeerIds = liaisonId && !peerIds.includes(liaisonId)
            ? [liaisonId, ...peerIds]
            : peerIds;
        conversations = await loadPeerConversations(mergedPeerIds);
    }

    let coachPlans: { id: string; name: string; type?: string }[] = [];
    if (isCoachRole(user.role)) {
        const rawPlans = await prisma.plan.findMany({
            where: user.role === "COACH" ? { creatorId: user.id } : {},
            select: { id: true, name: true, type: true, updatedAt: true, creatorId: true },
            orderBy: { updatedAt: "desc" },
        });
        coachPlans = dedupeCoachPlansByName(rawPlans).map(({ id, name, type }) => ({ id, name, type }));
    }

    let initialUnread: Record<string, number> = {};
    if (conversations.length > 0 && (isClientRole(user.role) || isCoachRole(user.role))) {
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

    if (conversations.length > 0) {
        const nicknameMap = await loadNicknameMap(user.id, conversations.map((c) => c.userId));
        if (nicknameMap.size > 0) {
            conversations = conversations.map((conversation) => ({
                ...conversation,
                name: pickDisplayName(
                    conversation.name,
                    conversation.email,
                    nicknameMap.get(conversation.userId),
                    conversation.name
                ),
            }));
        }
    }

    return (
        <ChatClient
            currentUserId={user.id}
            currentUserRole={user.role}
            conversations={conversations}
            canUseDirectChat={isClientRole(user.role) || isCoachRole(user.role)}
            coachPlans={coachPlans}
            initialUnread={initialUnread}
        />
    );
}
