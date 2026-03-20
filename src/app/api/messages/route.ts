import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET messages — supports direct (receiverId) and general (isGeneral=true)
export async function GET(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const url = new URL(req.url);
    const isGeneral = url.searchParams.get("general") === "true";
    const withUserId = url.searchParams.get("with"); // for DM
    const limit = parseInt(url.searchParams.get("limit") ?? "50");

    let where = {};

    if (isGeneral) {
        where = { isGeneral: true };
    } else if (withUserId) {
        where = {
            isGeneral: false,
            OR: [
                { senderId: user.id, receiverId: withUserId },
                { senderId: withUserId, receiverId: user.id },
            ],
        };
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
    mediaUrl: z.string().url().optional(),
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

    // Free users can now access general chat per request.

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
