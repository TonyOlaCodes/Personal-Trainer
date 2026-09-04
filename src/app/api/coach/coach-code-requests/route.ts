import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachUser } from "@/lib/apiAuth";
import { coachIgnoreCoachCodeRequest, listCoachCodeRequestsForCoach } from "@/lib/coachCodeRequest";

const patchSchema = z.object({
    action: z.literal("ignore"),
    dispatchId: z.string().min(1),
});

export async function GET() {
    const authResult = await requireCoachUser();
    if (authResult.error) return authResult.error;

    const requests = await listCoachCodeRequestsForCoach(authResult.user.id);
    return NextResponse.json({ requests });
}

export async function PATCH(req: Request) {
    const authResult = await requireCoachUser();
    if (authResult.error) return authResult.error;

    try {
        const parsed = patchSchema.parse(await req.json());
        await coachIgnoreCoachCodeRequest(authResult.user.id, parsed.dispatchId);
        return NextResponse.json({ ok: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Could not update request";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
