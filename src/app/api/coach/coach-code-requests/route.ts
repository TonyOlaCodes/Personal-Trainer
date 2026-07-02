import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthUser } from "@/lib/apiAuth";
import { coachIgnoreCoachCodeRequest, listCoachCodeRequestsForCoach } from "@/lib/coachCodeRequest";
import { isCoachRole } from "@/lib/roles";

const patchSchema = z.object({
    action: z.literal("ignore"),
    dispatchId: z.string().min(1),
});

export async function GET() {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    if (!isCoachRole(authResult.user.role as never)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requests = await listCoachCodeRequestsForCoach(authResult.user.id);
    return NextResponse.json({ requests });
}

export async function PATCH(req: Request) {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    if (!isCoachRole(authResult.user.role as never)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const parsed = patchSchema.parse(await req.json());
        await coachIgnoreCoachCodeRequest(authResult.user.id, parsed.dispatchId);
        return NextResponse.json({ ok: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Could not update request";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
