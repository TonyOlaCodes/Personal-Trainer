import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachUser } from "@/lib/apiAuth";
import { enforceRateLimit } from "@/lib/rateLimit";
import { broadcastCoachMessage } from "@/lib/coachChat";

const schema = z.object({
    content: z.string().min(1).max(2000),
    clientIds: z.array(z.string().min(1)).optional(),
});

export async function POST(req: Request) {
    const authResult = await requireCoachUser(req);
    if (authResult.error) return authResult.error;
    const coach = authResult.user;
    const limited = await enforceRateLimit(req, "coachNotify", coach.id);
    if (limited) return limited;

    try {
        const parsed = schema.parse(await req.json());
        const result = await broadcastCoachMessage(coach, parsed);
        return NextResponse.json(result);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to broadcast message";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
