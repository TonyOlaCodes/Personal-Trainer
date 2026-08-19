import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCoachCanEditClient } from "@/lib/apiAuth";
import {
    ensureCoachClientPauseColumns,
    getCoachPauseStatus,
    pauseClientForCoach,
    resumeClientForCoach,
} from "@/lib/coachClientPause";
import { z } from "zod";

const schema = z.object({
    clientId: z.string().min(1),
    paused: z.boolean(),
});

/** Coach-only pause/resume — does not deactivate the client's account. */
export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const coach = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { clientId, paused } = parsed.data;

    const editCheck = await requireCoachCanEditClient(coach, clientId);
    if (editCheck.error) return editCheck.error;

    await ensureCoachClientPauseColumns();

    if (paused) {
        await pauseClientForCoach(clientId);
    } else {
        await resumeClientForCoach(clientId);
    }

    const status = await getCoachPauseStatus(clientId);
    return NextResponse.json({
        success: true,
        isCoachPaused: status.isCoachPaused,
        coachPausedAt: status.coachPausedAt?.toISOString() ?? null,
        coachResumedAt: status.coachResumedAt?.toISOString() ?? null,
    });
}
