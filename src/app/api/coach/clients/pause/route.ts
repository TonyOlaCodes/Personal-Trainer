import { NextResponse } from "next/server";
import { requireCoachCanEditClient, requireCoachUser } from "@/lib/apiAuth";
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
    const authResult = await requireCoachUser(req);
    if (authResult.error) return authResult.error;
    const coach = authResult.user;

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
