import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthUser } from "@/lib/apiAuth";

const visibilitySchema = z.object({
    isPublic: z.boolean(),
});

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ planId: string }> }
) {
    const authResult = await requireAuthUser(req);
    if (authResult.error) return authResult.error;

    const { planId } = await params;
    const user = authResult.user;

    const body = visibilitySchema.parse(await req.json());

    const plan = await prisma.plan.findUnique({
        where: { id: planId },
        select: { id: true, creatorId: true, type: true },
    });

    if (!plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const isOwner = plan.creatorId === user.id;
    const isAdmin = user.role === "SUPER_ADMIN";

    if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (plan.type !== "USER_CREATED") {
        return NextResponse.json({ error: "Only custom plans can be made public" }, { status: 400 });
    }

    const updated = await prisma.plan.update({
        where: { id: planId },
        data: { isPublic: body.isPublic },
        select: { id: true, isPublic: true },
    });

    return NextResponse.json(updated);
}
