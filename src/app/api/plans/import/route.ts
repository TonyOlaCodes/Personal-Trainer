import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/apiAuth";
import { enforceRateLimit } from "@/lib/rateLimit";
import { isCoachRole } from "@/lib/roles";
import { clonePlanForUser } from "@/lib/planClone";
import { resolvePlanOriginalCreatorId } from "@/lib/planCreator";
import { triggerAchievementSyncForUsers } from "@/lib/achievements";

export async function POST(req: Request) {
    const authResult = await requireActiveUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;
    const limited = await enforceRateLimit(req, "planImport", user.id);
    if (limited) return limited;

    const { code } = await req.json();
    if (!code) return NextResponse.json({ error: "Share code is required" }, { status: 400 });

    const originalPlan = await prisma.plan.findUnique({
        where: { shareCode: code.toUpperCase().trim() },
        select: {
            id: true,
            creatorId: true,
            originalCreatorId: true,
            creator: { select: { name: true } },
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

    const originalOwnerId = resolvePlanOriginalCreatorId(originalPlan);
    triggerAchievementSyncForUsers(user.id, originalOwnerId);

    return NextResponse.json({
        author: authorName,
        id: clonedPlan.id
    }, { status: 200 });
}
