import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthUser } from "@/lib/apiAuth";
import { canCopyUserPlan } from "@/lib/userProfile";
import { clonePlanForUser } from "@/lib/planClone";
import { isCoachRole } from "@/lib/roles";

export async function POST(
    _req: Request,
    { params }: { params: Promise<{ planId: string }> }
) {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    const { planId } = await params;
    const viewer = authResult.user;

    const plan = await prisma.plan.findUnique({
        where: { id: planId },
        select: { id: true, creatorId: true, name: true },
    });

    if (!plan?.creatorId) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const allowed = await canCopyUserPlan(
        { id: viewer.id, role: viewer.role },
        planId,
        plan.creatorId
    );

    if (!allowed) {
        return NextResponse.json({ error: "This plan is not available to copy" }, { status: 403 });
    }

    const cloned = await clonePlanForUser(planId, viewer.id, " (Copied)");
    if (!cloned) {
        return NextResponse.json({ error: "Could not copy plan" }, { status: 500 });
    }

    if (!isCoachRole(viewer.role)) {
        await prisma.userPlan.create({
            data: { userId: viewer.id, planId: cloned.id },
        });
    }

    return NextResponse.json({
        id: cloned.id,
        name: cloned.name,
        route: `/plans?highlight=${cloned.id}`,
    });
}
