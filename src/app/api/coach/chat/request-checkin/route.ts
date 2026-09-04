import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachUser } from "@/lib/apiAuth";
import { enforceRateLimit } from "@/lib/rateLimit";
import { sendCheckInRequestViaChat } from "@/lib/coachChat";
import { withResolvedAvatar, withResolvedUpload } from "@/lib/uploadUrls";

const schema = z.object({
    clientId: z.string().min(1),
    note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
    const authResult = await requireCoachUser(req);
    if (authResult.error) return authResult.error;
    const coach = authResult.user;
    const limited = await enforceRateLimit(req, "checkInRequest", coach.id);
    if (limited) return limited;

    try {
        const parsed = schema.parse(await req.json());
        const message = await sendCheckInRequestViaChat(coach, parsed.clientId, parsed.note);
        if (!message) {
            return NextResponse.json({ ok: true }, { status: 201 });
        }

        return NextResponse.json(withResolvedUpload({
            ...message,
            sender: withResolvedAvatar({
                id: message.sender.id,
                name: message.sender.name ?? "Coach",
                avatarUrl: message.sender.avatarUrl,
                role: message.sender.role,
            }),
        }), { status: 201 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to send check-in request";
        const status = message === "Forbidden" ? 403 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
