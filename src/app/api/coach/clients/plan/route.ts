import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createNotification } from "@/lib/notifications";
import { requireCoachCanEditClient } from "@/lib/apiAuth";

const planUpdateSchema = z.object({
    clientId: z.string().min(1),
    planId: z.string().min(1),
});

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const coach = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { clientId, planId } = planUpdateSchema.parse(await req.json());

        const editCheck = await requireCoachCanEditClient(coach, clientId);
        if (editCheck.error) return editCheck.error;

        const client = await prisma.user.findUnique({ where: { id: clientId } });
        if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

        // Update plan in transaction
        await prisma.$transaction(async (tx) => {
            // Deactivate existing
            await tx.userPlan.updateMany({
                where: { userId: client.id },
                data: { isActive: false },
            });

            // Create or update connection
            const existing = await tx.userPlan.findUnique({
                where: { userId_planId: { userId: client.id, planId: planId } }
            });

            if (existing) {
                await tx.userPlan.update({
                    where: { id: existing.id },
                    data: { isActive: true }
                });
            } else {
                await tx.userPlan.create({
                    data: { userId: client.id, planId: planId, isActive: true }
                });
            }
        });

        await createNotification({
            userId: client.id,
            type: "PLAN_UPDATED",
            message: "Your plan has been updated",
            entityType: "PLAN",
            entityId: plan.id,
            route: `/plans?highlight=${plan.id}`,
        });

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to assign plan";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
