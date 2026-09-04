import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCoachUser } from "@/lib/apiAuth";
import { enforceRateLimit } from "@/lib/rateLimit";
import { sendPlanViaChat } from "@/lib/coachChat";
import { triggerAchievementSync } from "@/lib/achievements";
import { withResolvedAvatar, withResolvedUpload } from "@/lib/uploadUrls";

const schema = z.object({
    clientId: z.string().min(1),
    planId: z.string().min(1),
    note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
    const authResult = await requireCoachUser(req);
    if (authResult.error) return authResult.error;
    const coach = authResult.user;
    const limited = await enforceRateLimit(req, "coachNotify", coach.id);
    if (limited) return limited;

    try {
        const parsed = schema.parse(await req.json());
        const message = await sendPlanViaChat(coach, parsed.clientId, parsed.planId, parsed.note);
        triggerAchievementSync(coach.id);

        return NextResponse.json(withResolvedUpload({
            ...message,
            sender: withResolvedAvatar({
                id: message.sender.id,
                name: (message.sender as { isDeleted?: boolean; deletedName?: string | null }).isDeleted
                    ? ((message.sender as { deletedName?: string | null }).deletedName ?? "Deleted User")
                    : (message.sender.name ?? "User"),
                avatarUrl: (message.sender as { isDeleted?: boolean }).isDeleted ? null : message.sender.avatarUrl,
                role: message.sender.role,
            }),
        }), { status: 201 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to send plan";
        const status = message === "Forbidden" ? 403 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
