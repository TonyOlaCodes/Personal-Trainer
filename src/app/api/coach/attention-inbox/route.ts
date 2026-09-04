import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachCanEditClient, requireCoachUser } from "@/lib/apiAuth";
import { enforceRateLimit } from "@/lib/rateLimit";
import {
    setCoachAttentionAction,
    type CoachAttentionCategory,
} from "@/lib/coachAttentionActions";
import { loadCoachAttentionInbox } from "@/lib/coachAttentionInbox";
import { createCoachDirectMessage, sendCheckInRequestViaChat, sendMissedWorkoutNotifyViaChat } from "@/lib/coachChat";
import { triggerAchievementSync } from "@/lib/achievements";

export async function GET(req: Request) {
    const authResult = await requireCoachUser(req);
    if (authResult.error) return authResult.error;
    const coach = authResult.user;

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
    const authResult = await requireCoachUser(req);
    if (authResult.error) return authResult.error;
    const coach = authResult.user;

    try {
        const parsed = actionSchema.parse(await req.json());
        if (parsed.operation === "notify" || parsed.operation === "message") {
            const limited = await enforceRateLimit(
                req,
                parsed.operation === "notify" && (parsed.category === "check_in_overdue" || parsed.category === "check_in_missed")
                    ? "checkInRequest"
                    : parsed.operation === "message"
                        ? "messageSend"
                        : "coachNotify",
                coach.id
            );
            if (limited) return limited;
        }
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
            if (
                (category === "check_in_overdue" || category === "check_in_missed")
                && parsed.weekNumber != null
            ) {
                const { clearCheckInRequest } = await import("@/lib/checkInRequests");
                await clearCheckInRequest(parsed.clientId, parsed.weekNumber);
            }
            triggerAchievementSync(coach.id);
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
            triggerAchievementSync(coach.id);
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
                    parsed.message,
                    {
                        weekNumber: parsed.weekNumber,
                        skipChat: false,
                    }
                );
            } else if (category === "missed_workout") {
                await sendMissedWorkoutNotifyViaChat(coach, parsed.clientId, {
                    message: parsed.message,
                    workoutId: parsed.workoutId ?? null,
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
