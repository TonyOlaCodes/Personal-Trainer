import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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

        // Verify relationship
        const client = await prisma.user.findUnique({ where: { id: clientId } });
        if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
        
        if (coach.role === "COACH" && client.coachId !== coach.id) {
            return NextResponse.json({ error: "Unauthorized: Not your client" }, { status: 403 });
        }

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

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
