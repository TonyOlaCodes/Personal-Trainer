import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoachCanEditClient } from "@/lib/apiAuth";
import {
    setCoachAttentionAction,
    type CoachAttentionCategory,
} from "@/lib/coachAttentionActions";
import { loadCoachAttentionInbox } from "@/lib/coachAttentionInbox";
import { createCoachDirectMessage, sendCheckInRequestViaChat } from "@/lib/coachChat";
import { createNotification } from "@/lib/notifications";
import { NOTIFICATION_TYPES, QUICK_REPLY_TEMPLATES } from "@/lib/notificationTypes";

export async function GET() {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const coach = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const items = await loadCoachAttentionInbox(coach.id);
    const openCount = items.filter((item) => item.status === "open").length;

    return NextResponse.json({ items, openCount });
}

const actionSchema = z.object({
    alertKey: z.string().min(1),
    clientId: z.string().min(1),
    category: z.enum([
        "missed_workout",
        "check_in_overdue",
        "check_in_missed",
        "pending_check_in",
        "unread_message",
        "setup_needed",
        "falling_behind",
    ]),
    operation: z.enum(["dismiss", "excuse", "notify", "message"]),
    message: z.string().max(1000).optional(),
    weekNumber: z.number().int().optional(),
    dateKey: z.string().optional(),
    workoutId: z.string().optional(),
});

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const coach = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const parsed = actionSchema.parse(await req.json());
        const authz = await requireCoachCanEditClient(coach, parsed.clientId);
        if (authz.error) return authz.error;

        const category = parsed.category as CoachAttentionCategory;

        if (parsed.operation === "dismiss") {
            await setCoachAttentionAction({
                coachId: coach.id,
                clientId: parsed.clientId,
                alertKey: parsed.alertKey,
                action: "dismissed",
                category,
                weekNumber: parsed.weekNumber ?? null,
                dateKey: parsed.dateKey ?? null,
                workoutId: parsed.workoutId ?? null,
            });
            return NextResponse.json({ ok: true });
        }

        if (parsed.operation === "excuse") {
            if (category !== "missed_workout") {
                return NextResponse.json({ error: "Only missed workouts can be excused" }, { status: 400 });
            }
            await setCoachAttentionAction({
                coachId: coach.id,
                clientId: parsed.clientId,
                alertKey: parsed.alertKey,
                action: "excused",
                category,
                weekNumber: parsed.weekNumber ?? null,
                dateKey: parsed.dateKey ?? null,
                workoutId: parsed.workoutId ?? null,
            });
            return NextResponse.json({ ok: true });
        }

        if (parsed.operation === "notify") {
            if (
                category === "check_in_overdue"
                || category === "check_in_missed"
            ) {
                await sendCheckInRequestViaChat(
                    coach,
                    parsed.clientId,
                    parsed.message ?? "Please complete your weekly check-in when you can."
                );
            } else if (category === "missed_workout") {
                const content =
                    parsed.message
                    ?? QUICK_REPLY_TEMPLATES[NOTIFICATION_TYPES.CLIENT_MISSED_WORKOUT];
                await createCoachDirectMessage({
                    coach,
                    clientId: parsed.clientId,
                    content,
                });
                await createNotification({
                    userId: parsed.clientId,
                    type: NOTIFICATION_TYPES.CLIENT_MISSED_WORKOUT,
                    message: content,
                    entityType: "WORKOUT",
                    entityId: parsed.workoutId ?? null,
                    route: "/dashboard",
                });
            } else {
                return NextResponse.json({ error: "Notify is not supported for this alert type" }, { status: 400 });
            }
            return NextResponse.json({ ok: true });
        }

        if (parsed.operation === "message") {
            const content = parsed.message?.trim();
            if (!content) {
                return NextResponse.json({ error: "Message is required" }, { status: 400 });
            }
            await createCoachDirectMessage({
                coach,
                clientId: parsed.clientId,
                content,
            });
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ error: "Unknown operation" }, { status: 400 });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid request" }, { status: 400 });
        }
        console.error("[POST /api/coach/attention-inbox]", err);
        return NextResponse.json({ error: "Action failed" }, { status: 500 });
    }
}
