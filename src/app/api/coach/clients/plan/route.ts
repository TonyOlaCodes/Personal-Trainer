import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { notifyClientOfPlanAssigned } from "@/lib/notifications";
import { requireCoachCanEditClient } from "@/lib/apiAuth";
import { triggerAchievementSync } from "@/lib/achievements";
import { assignCoachPlanToClient, removeCoachPlanFromClient } from "@/lib/coachPlanAssignment";

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

        const result = await assignCoachPlanToClient({
            coachId: coach.id,
            clientId: client.id,
            planId,
            allowAnyCoachPlan: coach.role === "SUPER_ADMIN",
        });

        await notifyClientOfPlanAssigned({
            clientUserId: client.id,
            coachId: coach.id,
            coachName: coach.name ?? coach.email ?? "Your coach",
            planId: result.assignedPlanId,
            planName: result.plan.name,
        });

        triggerAchievementSync(coach.id);

        return NextResponse.json({
            success: true,
            planId: result.assignedPlanId,
            cloned: result.cloned,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to assign plan";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

const planRemoveSchema = z.object({
    clientId: z.string().min(1),
});

export async function DELETE(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const coach = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { clientId } = planRemoveSchema.parse(await req.json());

        const editCheck = await requireCoachCanEditClient(coach, clientId);
        if (editCheck.error) return editCheck.error;

        const result = await removeCoachPlanFromClient({
            coachId: coach.id,
            clientId,
            allowAnyCoachPlan: coach.role === "SUPER_ADMIN",
        });

        return NextResponse.json({ success: true, removed: result.removed });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to remove plan";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
