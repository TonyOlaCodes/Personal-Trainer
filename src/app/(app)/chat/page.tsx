import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDirectMessageActivity } from "@/lib/chatActivity";
import { withResolvedAvatar } from "@/lib/uploadUrls";
import { ChatClient } from "./ChatClient";

export const metadata = { title: "Chat" };

export default async function ChatPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) redirect("/sign-in");

    // Build conversation list:
    // For clients → their coach
    // For coaches → their clients
    // For admin → all coaches + clients
    let conversations: {
        userId: string;
        name: string;
        role: string;
        avatarUrl: string | null;
        isDeleted?: boolean;
        lastMessageAt?: string | null;
        lastActiveAt?: string | null;
    }[] = [];

    if (user.role === "PREMIUM") {
        // Show coach if assigned
        if (user.coachId) {
            const coach = await prisma.user.findUnique({
                where: { id: user.coachId },
                select: { id: true, name: true, role: true, avatarUrl: true, isDeleted: true, deletedName: true, lastActiveAt: true },
            });
            if (coach) {
                conversations = [withResolvedAvatar({
                    userId: coach.id,
                    name: coach.isDeleted ? (coach.deletedName ?? "Deleted Coach") : (coach.name ?? "Coach"),
                    role: coach.role,
                    avatarUrl: coach.isDeleted ? null : coach.avatarUrl,
                    isDeleted: coach.isDeleted,
                    lastActiveAt: coach.lastActiveAt?.toISOString() ?? null,
                })];
            }
        }
    } else if (user.role === "SUPER_ADMIN") {
        const users = await prisma.user.findMany({
            where: { id: { not: user.id } },
            select: { id: true, name: true, role: true, avatarUrl: true, isDeleted: true, deletedName: true, lastActiveAt: true },
            orderBy: [{ isDeleted: "asc" }, { name: "asc" }],
        });
        conversations = users.map((c) => withResolvedAvatar({
            userId: c.id,
            name: c.isDeleted ? (c.deletedName ?? "Deleted User") : (c.name ?? "User"),
            role: c.role,
            avatarUrl: c.isDeleted ? null : c.avatarUrl,
            isDeleted: c.isDeleted,
            lastActiveAt: c.lastActiveAt?.toISOString() ?? null,
        }));
    } else if (user.role === "COACH") {
        const clients = await prisma.user.findMany({
            where: { coachId: user.id },
            select: { id: true, name: true, role: true, avatarUrl: true, isDeleted: true, deletedName: true, lastActiveAt: true },
        });
        conversations = clients.map((c) => withResolvedAvatar({
            userId: c.id,
            name: c.isDeleted ? (c.deletedName ?? "Deleted Athlete") : (c.name ?? "Client"),
            role: c.role,
            avatarUrl: c.isDeleted ? null : c.avatarUrl,
            isDeleted: c.isDeleted,
            lastActiveAt: c.lastActiveAt?.toISOString() ?? null,
        }));
    }

    if (conversations.length > 0 && user.role !== "FREE") {
        const activity = await getDirectMessageActivity(
            user.id,
            conversations.map((conversation) => conversation.userId)
        );
        conversations = conversations.map((conversation) => ({
            ...conversation,
            lastMessageAt: activity[conversation.userId] ?? null,
        }));
    }

    return (
        <div className="-mb-20 h-0 overflow-hidden md:mb-0 md:h-auto md:overflow-visible">
            <ChatClient
                currentUserId={user.id}
                currentUserRole={user.role}
                conversations={conversations}
                canUseDirectChat={user.role !== "FREE"}
            />
        </div>
    );
}
