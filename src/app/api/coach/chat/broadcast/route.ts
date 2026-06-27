import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { broadcastCoachMessage } from "@/lib/coachChat";

const schema = z.object({
    content: z.string().min(1).max(2000),
    clientIds: z.array(z.string().min(1)).optional(),
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
        const result = await broadcastCoachMessage(coach, parsed);
        return NextResponse.json(result);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to broadcast message";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
