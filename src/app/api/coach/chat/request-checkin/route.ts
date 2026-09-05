import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachUser } from "@/lib/apiAuth";
import { enforceRateLimit } from "@/lib/rateLimit";
import { sendCheckInRequestViaChat } from "@/lib/coachChat";
import { CHECK_IN_REQUEST_FAILED_MESSAGE } from "@/lib/checkInRequests";
import { withResolvedAvatar, withResolvedUpload } from "@/lib/uploadUrls";

const schema = z.object({
    clientId: z.string().min(1),
    note: z.string().max(500).optional(),
    weekNumber: z.number().int().positive().optional(),
    periodDueDateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(req: Request) {
    const authResult = await requireCoachUser(req);
    if (authResult.error) return authResult.error;
    const coach = authResult.user;
    const limited = await enforceRateLimit(req, "checkInRequest", coach.id);
    if (limited) return limited;

    try {
        const parsed = schema.parse(await req.json());
        const message = await sendCheckInRequestViaChat(coach, parsed.clientId, parsed.note, {
            weekNumber: parsed.weekNumber,
            periodDueDateKey: parsed.periodDueDateKey,
        });
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
        if (err instanceof z.ZodError) {
            console.error("[POST /api/coach/chat/request-checkin] validation", err.issues);
            return NextResponse.json({ error: CHECK_IN_REQUEST_FAILED_MESSAGE }, { status: 400 });
        }
        const raw = err instanceof Error ? err.message : "Failed to send check-in request";
        if (raw === "Forbidden") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        console.error("[POST /api/coach/chat/request-checkin]", err);
        return NextResponse.json({ error: CHECK_IN_REQUEST_FAILED_MESSAGE }, { status: 400 });
    }
}
