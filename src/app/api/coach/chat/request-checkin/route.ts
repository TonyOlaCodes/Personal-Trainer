import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendCheckInRequestViaChat } from "@/lib/coachChat";
import { withResolvedAvatar, withResolvedUpload } from "@/lib/uploadUrls";

const schema = z.object({
    clientId: z.string().min(1),
    note: z.string().max(500).optional(),
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
        const message = await sendCheckInRequestViaChat(coach, parsed.clientId, parsed.note);

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
