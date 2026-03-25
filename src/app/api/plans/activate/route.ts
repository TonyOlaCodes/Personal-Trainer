import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// POST /api/plans/activate  — set one plan as active, or pass null to deactivate all
export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { planId } = z.object({ planId: z.string().nullable() }).parse(await req.json());

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Always deactivate all first
    await prisma.userPlan.updateMany({
        where: { userId: user.id },
        data: { isActive: false },
    });

    // If a planId was provided, activate it
    if (planId) {
        await prisma.userPlan.update({
            where: { userId_planId: { userId: user.id, planId } },
            data: { isActive: true },
        });
    }

    return NextResponse.json({ success: true });
}
