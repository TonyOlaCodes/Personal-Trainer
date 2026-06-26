import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAuthUser } from "@/lib/apiAuth";
import { isCoachRole } from "@/lib/roles";

// POST /api/plans/activate  — set one plan as active, or pass null to deactivate all
export async function POST(req: Request) {
    const authResult = await requireAuthUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    if (isCoachRole(user.role)) {
        return NextResponse.json(
            { error: "Coach accounts cannot activate training plans on themselves." },
            { status: 403 }
        );
    }

    const { planId } = z.object({ planId: z.string().nullable() }).parse(await req.json());

    await prisma.userPlan.updateMany({
        where: { userId: user.id },
        data: { isActive: false },
    });

    if (planId) {
        const assignment = await prisma.userPlan.findUnique({
            where: { userId_planId: { userId: user.id, planId } },
        });
        if (!assignment) {
            return NextResponse.json({ error: "Plan is not in your library" }, { status: 404 });
        }

        await prisma.userPlan.update({
            where: { userId_planId: { userId: user.id, planId } },
            data: { isActive: true },
        });
    }

    return NextResponse.json({ success: true });
}
