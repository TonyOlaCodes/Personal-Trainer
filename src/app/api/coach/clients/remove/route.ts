import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releasePremiumAccessCodesForUser } from "@/lib/accessCodes";
import { requireCoachCanEditClient, requireCoachUser } from "@/lib/apiAuth";
import { z } from "zod";

const schema = z.object({
    clientId: z.string(),
});

export async function POST(req: Request) {
    const authResult = await requireCoachUser(req);
    if (authResult.error) return authResult.error;
    const coach = authResult.user;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { clientId } = parsed.data;

    const editCheck = await requireCoachCanEditClient(coach, clientId);
    if (editCheck.error) return editCheck.error;

    const client = await prisma.user.findUnique({ where: { id: clientId } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    // Demote client and release their premium access code for reuse
    await prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: clientId },
            data: {
                coachId: null,
                role: "GENERAL_PREMIUM",
            },
        });
        await releasePremiumAccessCodesForUser(tx, clientId);
    });

    return NextResponse.json({ success: true });
}
