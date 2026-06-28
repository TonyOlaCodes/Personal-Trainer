import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCoachCanEditClient } from "@/lib/apiAuth";
import {
    buildMissedWorkoutAlertKey,
    removeCoachAttentionAction,
    setCoachAttentionAction,
} from "@/lib/coachAttentionActions";
import { triggerAchievementSync } from "@/lib/achievements";

const schema = z.object({
    clientId: z.string().min(1),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    workoutId: z.string().min(1),
    status: z.enum(["excused", "missed"]),
});

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const coach = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const parsed = schema.parse(await req.json());
        const authz = await requireCoachCanEditClient(coach, parsed.clientId);
        if (authz.error) return authz.error;

        const alertKey = buildMissedWorkoutAlertKey(
            parsed.clientId,
            parsed.dateKey,
            parsed.workoutId
        );

        if (parsed.status === "excused") {
            await setCoachAttentionAction({
                coachId: coach.id,
                clientId: parsed.clientId,
                alertKey,
                action: "excused",
                category: "missed_workout",
                dateKey: parsed.dateKey,
                workoutId: parsed.workoutId,
            });
        } else {
            await removeCoachAttentionAction(coach.id, alertKey);
        }

        triggerAchievementSync(coach.id);

        return NextResponse.json({ ok: true, status: parsed.status });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid request" }, { status: 400 });
        }
        console.error("[POST /api/coach/workout-status]", err);
        return NextResponse.json({ error: "Failed to update workout status" }, { status: 500 });
    }
}
