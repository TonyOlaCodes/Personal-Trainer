import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET messages
export async function GET(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.update({
        where: { clerkId: userId },
        data: { updatedAt: new Date() }
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const url = new URL(req.url);
    const isGeneral = url.searchParams.get("general") === "true";
    const withUserId = url.searchParams.get("with");
    const limit = parseInt(url.searchParams.get("limit") ?? "80");

    let where: any = {};

    if (isGeneral) {
        where = { isGeneral: true };
    } else if (withUserId) {
        if (withUserId.startsWith("team_")) {
            where = { isGeneral: false, receiverId: withUserId };
        } else {
            where = {
                isGeneral: false,
                OR: [
                    { senderId: user.id, receiverId: withUserId },
                    { senderId: withUserId, receiverId: user.id },
                ],
            };
        }
    }

    const messages = await prisma.message.findMany({
        where,
        include: {
            sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
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
        orderBy: { createdAt: "asc" },
        take: limit,
    });

    // Mark unread messages as delivered
    const unreadIds = messages
        .filter(m => m.senderId !== user.id && m.status === "SENT")
        .map(m => m.id);

    if (unreadIds.length > 0) {
        await prisma.message.updateMany({
            where: { id: { in: unreadIds } },
            data: { status: "DELIVERED" }
        });
    }

    return NextResponse.json(messages);
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
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const parsed = msgSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { content, receiverId, isGeneral, type, mediaUrl, replyToId, mentions } = parsed.data;

    const message = await prisma.message.create({
        data: {
            senderId: user.id,
            receiverId: isGeneral ? null : receiverId,
            content,
            isGeneral,
            type: type as any,
            mediaUrl,
            replyToId: replyToId || null,
            mentions: mentions || [],
            status: "SENT",
        },
        include: {
            sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
            replyTo: {
                select: {
                    id: true, content: true, type: true,
                    sender: { select: { id: true, name: true } }
                }
            },
            reactions: true,
        },
    });

    return NextResponse.json(message, { status: 201 });
}

// PATCH edit or update message
export async function PATCH(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const { id, content, action, emoji } = body;

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });

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
        return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "No action specified" }, { status: 400 });
}

// DELETE a message
export async function DELETE(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (msg.senderId !== user.id && !["COACH", "SUPER_ADMIN"].includes(user.role)) {
        return NextResponse.json({ error: "Not your message" }, { status: 403 });
    }

    await prisma.message.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
