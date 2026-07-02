import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthUser } from "@/lib/apiAuth";
import {
    adminDispatchCoachCodeRequest,
    adminHandleCoachCodeRequestSelf,
    listPendingCoachCodeRequestsForAdmin,
} from "@/lib/coachCodeRequest";

const patchSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("handle_self"),
        requestId: z.string().min(1),
    }),
    z.object({
        action: z.literal("dispatch"),
        requestId: z.string().min(1),
        coachIds: z.array(z.string().min(1)).min(1),
    }),
]);

export async function GET() {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    if (authResult.user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requests = await listPendingCoachCodeRequestsForAdmin();
    return NextResponse.json({ requests });
}

export async function PATCH(req: Request) {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    if (authResult.user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const parsed = patchSchema.parse(await req.json());

        if (parsed.action === "handle_self") {
            const result = await adminHandleCoachCodeRequestSelf(authResult.user.id, parsed.requestId);
            return NextResponse.json(result);
        }

        const result = await adminDispatchCoachCodeRequest(
            authResult.user.id,
            parsed.requestId,
            parsed.coachIds
        );
        return NextResponse.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Could not update request";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
