import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { notifyClientOfCoachMessage } from "@/lib/notifications";
import {
    canAccessTeamChat,
    canDirectMessage,
    isMessageParticipant,
    parseTeamCoachId,
    requireAuthUser,
} from "@/lib/apiAuth";
import { isInactiveAccount } from "@/lib/userDeactivation";
import { getDirectMessageActivity } from "@/lib/chatActivity";
import { getUnreadCountsByPeer, getTotalUnreadDirectCount } from "@/lib/chatUnread";
import { notifyCoachOfClientMessage } from "@/lib/notifications";
import { isCoachRole } from "@/lib/roles";
import { getLastActiveMap, touchUserLastActive } from "@/lib/userPresence";
import { getActiveSessionsForClients } from "@/lib/coachChat";
import { withResolvedUpload, withResolvedAvatar, normalizeStoredUploadUrl } from "@/lib/uploadUrls";

// GET messages
export async function GET(req: Request) {
    const authResult = await requireAuthUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    await touchUserLastActive(user.id);

    const url = new URL(req.url);
    const isGeneral = url.searchParams.get("general") === "true";
    const withUserId = url.searchParams.get("with");
    const activityOnly = url.searchParams.get("activity") === "true";
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "80", 10) || 80, 100);
    const before = url.searchParams.get("before");

    if (activityOnly) {
        if (user.role === "FREE") {
            return NextResponse.json({ activity: {} });
        }

        let peerIds: string[] = [];
        if (user.role === "PREMIUM" && user.coachId) {
            peerIds = [user.coachId];
        } else if (user.role === "COACH") {
            const clients = await prisma.user.findMany({
                where: { coachId: user.id },
                select: { id: true },
            });
            peerIds = clients.map((client) => client.id);
        } else if (user.role === "SUPER_ADMIN") {
            const users = await prisma.user.findMany({
                where: { id: { not: user.id } },
                select: { id: true },
            });
            peerIds = users.map((peer) => peer.id);
        }

        const activity = await getDirectMessageActivity(user.id, peerIds);
        const unread = await getUnreadCountsByPeer(user.id, peerIds);
        const totalUnread = await getTotalUnreadDirectCount(user.id, peerIds);

        if (peerIds.length > 0) {
            await prisma.message.updateMany({
                where: {
                    receiverId: user.id,
                    senderId: { in: peerIds },
                    isGeneral: false,
                    status: "SENT",
                },
                data: { status: "DELIVERED" },
            });
        }

        const presence = isCoachRole(user.role)
            ? await getLastActiveMap(peerIds)
            : undefined;

        const activeSessions = isCoachRole(user.role)
            ? await getActiveSessionsForClients(peerIds)
            : undefined;

        return NextResponse.json({
            activity,
            unread,
            totalUnread,
            ...(presence ? { presence } : {}),
            ...(activeSessions ? { activeSessions } : {}),
        });
    }

    let where: Prisma.MessageWhereInput | null = null;

    if (isGeneral) {
        where = { isGeneral: true };
    } else if (withUserId) {
        if (user.role === "FREE") {
            return NextResponse.json({ error: "Direct coach chat requires Premium access" }, { status: 403 });
        }
        if (withUserId.startsWith("team_")) {
            const teamCoachId = parseTeamCoachId(withUserId);
            if (!teamCoachId || !(await canAccessTeamChat(user, teamCoachId))) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            where = { isGeneral: false, receiverId: withUserId };
        } else {
            if (!(await canDirectMessage(user, withUserId))) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            where = {
                isGeneral: false,
                OR: [
                    { senderId: user.id, receiverId: withUserId },
                    { senderId: withUserId, receiverId: user.id },
                ],
            };
        }
    } else {
        return NextResponse.json({ error: "Specify general=true or with=userId" }, { status: 400 });
    }

    const cursorWhere: Prisma.MessageWhereInput = before
        ? { ...where, createdAt: { lt: new Date(before) } }
        : where;

    const messages = await prisma.message.findMany({
        where: cursorWhere,
        include: {
            sender: { select: { id: true, name: true, avatarUrl: true, role: true, isDeleted: true, deletedName: true } },
            replyTo: {
                select: {
                    id: true, content: true, type: true,
                    sender: { select: { id: true, name: true } }
                }
            },
            reactions: {
                select: {
                    id: true, emoji: true, userId: true,
                    user: { select: { id: true, name: true } }
                }
            }
        },
        orderBy: { createdAt: "desc" },
        take: limit,
    });

    messages.reverse();

    const isDirectThread = Boolean(withUserId && !isGeneral);

    // Delivered: app received the message. Seen: recipient is viewing this thread.
    const incomingSentIds = messages
        .filter((m) => m.senderId !== user.id && m.status === "SENT")
        .map((m) => m.id);
    const incomingUnreadIds = messages
        .filter((m) => m.senderId !== user.id && m.status !== "SEEN")
        .map((m) => m.id);

    if (isDirectThread && incomingUnreadIds.length > 0) {
        await prisma.message.updateMany({
            where: { id: { in: incomingUnreadIds } },
            data: { status: "SEEN", isRead: true },
        });
    } else if (incomingSentIds.length > 0) {
        await prisma.message.updateMany({
            where: { id: { in: incomingSentIds } },
            data: { status: "DELIVERED" },
        });
    }

    const statusOverrides = new Map<string, "DELIVERED" | "SEEN">();
    if (isDirectThread) {
        for (const id of incomingUnreadIds) statusOverrides.set(id, "SEEN");
    } else {
        for (const id of incomingSentIds) statusOverrides.set(id, "DELIVERED");
    }

    const mappedMessages = messages.map(m => withResolvedUpload({
        ...m,
        actionType: (m as { actionType?: string | null }).actionType ?? null,
        actionEntityId: (m as { actionEntityId?: string | null }).actionEntityId ?? null,
        status: statusOverrides.get(m.id) ?? m.status,
        sender: withResolvedAvatar({
            id: m.sender.id,
            name: (m.sender as any).isDeleted ? ((m.sender as any).deletedName ?? "Deleted User") : (m.sender.name ?? "User"),
            avatarUrl: (m.sender as any).isDeleted ? null : m.sender.avatarUrl,
            role: m.sender.role
        }),
    }));

    return NextResponse.json({
        messages: mappedMessages,
        hasMore: messages.length === limit,
    });
}

const msgSchema = z.object({
    content: z.string().optional(),
    receiverId: z.string().optional(),
    isGeneral: z.boolean().default(false),
    type: z.enum(["TEXT", "IMAGE", "VIDEO"]).default("TEXT"),
    mediaUrl: z.string().optional(),
    replyToId: z.string().optional(),
    mentions: z.array(z.string()).optional(),
});

// POST send a message
export async function POST(req: Request) {
    const authResult = await requireAuthUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    await touchUserLastActive(user.id);

    const body = await req.json();
    const parsed = msgSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { content, receiverId, isGeneral, type, mediaUrl, replyToId, mentions } = parsed.data;

    if (!isGeneral) {
        if (!receiverId) {
            return NextResponse.json({ error: "receiverId required for direct messages" }, { status: 400 });
        }
        if (user.role === "FREE") {
            return NextResponse.json({ error: "Direct coach chat requires Premium access" }, { status: 403 });
        }
        if (receiverId.startsWith("team_")) {
            const teamCoachId = parseTeamCoachId(receiverId);
            if (!teamCoachId || !(await canAccessTeamChat(user, teamCoachId))) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        } else if (!(await canDirectMessage(user, receiverId))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const receiver = await prisma.user.findUnique({
            where: { id: receiverId },
            select: { email: true, isDeleted: true, isDeactivated: true },
        });
        if (receiver && isInactiveAccount(receiver)) {
            return NextResponse.json({ error: "Cannot message this account" }, { status: 403 });
        }
    }

    const message = await prisma.message.create({
        data: {
            senderId: user.id,
            receiverId: isGeneral ? null : receiverId,
            content,
            isGeneral,
            type,
            mediaUrl: mediaUrl ? normalizeStoredUploadUrl(mediaUrl) ?? mediaUrl : undefined,
            replyToId: replyToId || null,
            mentions: mentions || [],
            status: "SENT",
        },
        include: {
            sender: { select: { id: true, name: true, avatarUrl: true, role: true, isDeleted: true, deletedName: true } },
            replyTo: {
                select: {
                    id: true, content: true, type: true,
                    sender: { select: { id: true, name: true } }
                }
            },
            reactions: true,
        },
    });

    const mappedMessage = withResolvedUpload({
        ...message,
        sender: withResolvedAvatar({
            id: message.sender.id,
            name: (message.sender as any).isDeleted ? ((message.sender as any).deletedName ?? "Deleted User") : (message.sender.name ?? "User"),
            avatarUrl: (message.sender as any).isDeleted ? null : message.sender.avatarUrl,
            role: message.sender.role
        }),
    });

    if (!isGeneral && receiverId && ["COACH", "SUPER_ADMIN"].includes(user.role)) {
        const receiver = await prisma.user.findUnique({
            where: { id: receiverId },
            select: { id: true, coachId: true },
        });
        if (receiver && (user.role === "SUPER_ADMIN" || receiver.coachId === user.id)) {
            await notifyClientOfCoachMessage({
                clientUserId: receiver.id,
                coachId: user.id,
                coachName: user.name ?? user.email ?? "Your coach",
                route: `/chat?with=${user.id}`,
            });
        }
    }

    if (!isGeneral && receiverId && user.role === "PREMIUM" && user.coachId) {
        const receiver = await prisma.user.findUnique({
            where: { id: receiverId },
            select: { id: true, role: true },
        });
        if (receiver && ["COACH", "SUPER_ADMIN"].includes(receiver.role) && user.coachId === receiver.id) {
            await notifyCoachOfClientMessage({
                coachId: receiver.id,
                clientUserId: user.id,
                clientName: user.name ?? user.email ?? "Your client",
                route: `/chat?with=${user.id}`,
            });
        }
    }

    return NextResponse.json(mappedMessage, { status: 201 });
}

// PATCH edit or update message
export async function PATCH(req: Request) {
    const authResult = await requireAuthUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const body = await req.json();
    const { id, content, action, emoji } = body;

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    if (!(await isMessageParticipant(user, msg))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Mark as seen
    if (action === "markSeen") {
        if (msg.senderId !== user.id) {
            await prisma.message.update({
                where: { id },
                data: { status: "SEEN", isRead: true }
            });
        }
        return NextResponse.json({ ok: true });
    }

    // Toggle pin
    if (action === "togglePin") {
        const canPin = ["COACH", "SUPER_ADMIN"].includes(user.role) || (msg.receiverId && !msg.isGeneral);
        if (!canPin) return NextResponse.json({ error: "No permission to pin" }, { status: 403 });
        const updated = await prisma.message.update({
            where: { id },
            data: { isPinned: !msg.isPinned }
        });
        return NextResponse.json(updated);
    }

    // Add/remove reaction
    if (action === "react" && emoji) {
        const existing = await prisma.reaction.findUnique({
            where: { messageId_userId_emoji: { messageId: id, userId: user.id, emoji } }
        });
        if (existing) {
            await prisma.reaction.delete({ where: { id: existing.id } });
        } else {
            await prisma.reaction.create({
                data: { messageId: id, userId: user.id, emoji }
            });
        }
        const reactions = await prisma.reaction.findMany({
            where: { messageId: id },
            select: { id: true, emoji: true, userId: true, user: { select: { id: true, name: true } } }
        });
        return NextResponse.json({ reactions });
    }

    // Edit content
    if (content !== undefined) {
        if (msg.senderId !== user.id) return NextResponse.json({ error: "Not your message" }, { status: 403 });
        if (msg.type !== "TEXT") return NextResponse.json({ error: "Can only edit text messages" }, { status: 400 });
        const ageMs = Date.now() - new Date(msg.createdAt).getTime();
        if (ageMs > 2 * 60 * 1000) return NextResponse.json({ error: "Edit window expired" }, { status: 403 });

        const updated = await prisma.message.update({
            where: { id },
            data: { content: content.trim(), updatedAt: new Date() },
            include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
        });
        return NextResponse.json(withResolvedUpload({
            ...updated,
            sender: withResolvedAvatar(updated.sender),
        }));
    }

    return NextResponse.json({ error: "No action specified" }, { status: 400 });
}

// DELETE a message
export async function DELETE(req: Request) {
    const authResult = await requireAuthUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isSuperAdmin = user.role === "SUPER_ADMIN";

    if (!isSuperAdmin && !(await isMessageParticipant(user, msg))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isOwner = msg.senderId === user.id;
    const isCoach = user.role === "COACH";

    let canDelete = isOwner || isSuperAdmin;

    // Coaches can delete any message in their own team chat
    if (isCoach && msg.receiverId === `team_${user.id}`) {
        canDelete = true;
    }

    if (!canDelete) {
        return NextResponse.json({ error: "No permission to delete" }, { status: 403 });
    }

    await prisma.message.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
