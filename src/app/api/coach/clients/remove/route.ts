import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
    clientId: z.string(),
});

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const coach = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { clientId } = parsed.data;

    // Verify client belongs to coach
    const client = await prisma.user.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    if (coach.role !== "SUPER_ADMIN" && client.coachId !== coach.id) {
        return NextResponse.json({ error: "Forbidden: Not your client" }, { status: 403 });
    }

    // Demote: Remove coach association and set role back to FREE
    // Also invalidate the access code they used so it shows as "Expired/Revoked" in history
    await prisma.$transaction([
        prisma.user.update({
            where: { id: clientId },
            data: {
                coachId: null,
                role: "FREE",
            },
        }),
        prisma.accessCode.updateMany({
            where: { usedById: clientId },
            data: { isActive: false },
        }),
    ]);

    return NextResponse.json({ success: true });
}
