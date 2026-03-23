import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET messages — supports direct (receiverId) and general (isGeneral=true)
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
    const withUserId = url.searchParams.get("with"); // for DM
    const limit = parseInt(url.searchParams.get("limit") ?? "50");

    let where = {};

    if (isGeneral) {
        where = { isGeneral: true };
    } else if (withUserId) {
        if (withUserId.startsWith("team_")) {
            where = {
                isGeneral: false,
                receiverId: withUserId,
            };
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
        },
        orderBy: { createdAt: "asc" },
        take: limit,
    });

    return NextResponse.json(messages);
}

const msgSchema = z.object({
    content: z.string().optional(),
    receiverId: z.string().optional(),
    isGeneral: z.boolean().default(false),
    type: z.enum(["TEXT", "IMAGE", "VIDEO"]).default("TEXT"),
    mediaUrl: z.string().optional(), // accepts relative /uploads/... paths
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

    const { content, receiverId, isGeneral, type, mediaUrl } = parsed.data;

    const message = await prisma.message.create({
        data: {
            senderId: user.id,
            receiverId: isGeneral ? null : receiverId,
            content,
            isGeneral,
            type: type as never,
            mediaUrl,
        },
        include: {
            sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
        },
    });

    return NextResponse.json(message, { status: 201 });
}

// PATCH edit a message — only allowed within 2 minutes of sending
export async function PATCH(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id, content } = await req.json();
    if (!id || !content?.trim()) return NextResponse.json({ error: "Missing id or content" }, { status: 400 });

    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    if (msg.senderId !== user.id) return NextResponse.json({ error: "Not your message" }, { status: 403 });
    if (msg.type !== "TEXT") return NextResponse.json({ error: "Can only edit text messages" }, { status: 400 });

    // 2-minute edit window
    const ageMs = Date.now() - new Date(msg.createdAt).getTime();
    if (ageMs > 2 * 60 * 1000) {
        return NextResponse.json({ error: "Edit window expired (2 minutes)" }, { status: 403 });
    }

    const updated = await prisma.message.update({
        where: { id },
        data: { content: content.trim(), updatedAt: new Date() },
        include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
    });

    return NextResponse.json(updated);
}

// DELETE a message — only the sender can delete their own
export async function DELETE(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const msg = await prisma.message.findUnique({ where: { id } });
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (msg.senderId !== user.id) return NextResponse.json({ error: "Not your message" }, { status: 403 });

    await prisma.message.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
