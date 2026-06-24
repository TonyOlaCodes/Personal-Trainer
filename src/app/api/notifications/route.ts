import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";
import { getQuickReplyTemplate, supportsQuickReply } from "@/lib/notificationTypes";

function enrichNotification<T extends { type: string; entityType: string; entityId: string | null }>(notification: T) {
    const clientId = notification.entityType === "USER" && notification.entityId
        ? notification.entityId.split(":")[0]
        : null;

    return {
        ...notification,
        clientId,
        supportsQuickReply: supportsQuickReply(notification.type),
        quickReplyTemplate: supportsQuickReply(notification.type)
            ? getQuickReplyTemplate(notification.type)
            : null,
    };
}

const patchSchema = z.object({
    id: z.string().optional(),
    markAll: z.boolean().optional(),
});

export async function GET(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const notifications = await getNotifications(user.id, Number.isFinite(limit) ? limit : 20);

    return NextResponse.json({
        notifications: notifications.map((n) => enrichNotification({
            ...n,
            createdAt: n.createdAt.toISOString(),
        })),
        unreadCount: notifications.filter((n) => !n.read).length,
    });
}

export async function PATCH(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    if (parsed.data.markAll) {
        await markAllNotificationsRead(user.id);
    } else if (parsed.data.id) {
        await markNotificationRead(user.id, parsed.data.id);
    } else {
        return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
}
