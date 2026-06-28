import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCoachRole } from "@/lib/roles";
import { clonePlanForUser } from "@/lib/planClone";

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "Share code is required" }, { status: 400 });

    const originalPlan = await prisma.plan.findUnique({
        where: { shareCode: code.toUpperCase().trim() },
        include: {
            creator: true,
            originalCreator: { select: { name: true } },
        },
    });

    if (!originalPlan) return NextResponse.json({ error: "Plan not found! Verify your share code." }, { status: 404 });

    const clonedPlan = await clonePlanForUser(originalPlan.id, user.id, " (Imported)");
    if (!clonedPlan) {
        return NextResponse.json({ error: "Could not import plan" }, { status: 500 });
    }

    if (!isCoachRole(user.role)) {
        await prisma.userPlan.create({
            data: { userId: user.id, planId: clonedPlan.id },
        });
    }

    const authorName =
        originalPlan.originalCreator?.name
        ?? originalPlan.creator?.name
        ?? "Anonymous Athlete";

    return NextResponse.json({
        author: authorName,
        id: clonedPlan.id
    }, { status: 200 });
}
