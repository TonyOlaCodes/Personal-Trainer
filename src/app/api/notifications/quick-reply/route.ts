import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAccessClient, requireCoachUser } from "@/lib/apiAuth";
import { enforceRateLimit } from "@/lib/rateLimit";
import {
    getNotifications,
    markNotificationRead,
    notifyClientOfCoachMessage,
} from "@/lib/notifications";
import { getQuickReplyTemplate, supportsQuickReply } from "@/lib/notificationTypes";

const schema = z.object({
    notificationId: z.string(),
    content: z.string().trim().min(1).max(2000).optional(),
});

function clientIdFromNotification(entityType: string, entityId: string | null) {
    if (entityType !== "USER" || !entityId) return null;
    return entityId.split(":")[0] || null;
}

export async function POST(req: Request) {
    const authResult = await requireCoachUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;
    const limited = await enforceRateLimit(req, "messageSend", user.id);
    if (limited) return limited;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const notifications = await getNotifications(user.id, 50);
    const notification = notifications.find((n) => n.id === parsed.data.notificationId);
    if (!notification) {
        return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }
    if (!supportsQuickReply(notification.type)) {
        return NextResponse.json({ error: "Quick reply not supported for this notification" }, { status: 400 });
    }

    const clientId = clientIdFromNotification(notification.entityType, notification.entityId);
    if (!clientId || !(await canAccessClient(user, clientId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const content = parsed.data.content?.trim() || getQuickReplyTemplate(notification.type);
    if (!content) {
        return NextResponse.json({ error: "Message content required" }, { status: 400 });
    }

    const message = await prisma.message.create({
        data: {
            senderId: user.id,
            receiverId: clientId,
            content,
            isGeneral: false,
            type: "TEXT",
            status: "SENT",
        },
    });

    await notifyClientOfCoachMessage({
        clientUserId: clientId,
        coachId: user.id,
        coachName: user.name ?? user.email ?? "Your coach",
        route: `/chat?with=${user.id}`,
    });

    await markNotificationRead(user.id, notification.id);

    return NextResponse.json({
        ok: true,
        messageId: message.id,
        chatRoute: `/chat?with=${clientId}`,
    });
}
