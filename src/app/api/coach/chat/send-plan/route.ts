import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPlanViaChat } from "@/lib/coachChat";
import { withResolvedAvatar, withResolvedUpload } from "@/lib/uploadUrls";

const schema = z.object({
    clientId: z.string().min(1),
    planId: z.string().min(1),
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
        const message = await sendPlanViaChat(coach, parsed.clientId, parsed.planId, parsed.note);

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
