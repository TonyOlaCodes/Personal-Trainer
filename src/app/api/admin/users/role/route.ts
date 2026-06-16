import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserDeactivationStatusById, setUserDeactivationStatus } from "@/lib/userDeactivation";
import { z } from "zod";

const schema = z.object({
    userId: z.string(),
    role: z.enum(["FREE", "PREMIUM", "COACH", "SUPER_ADMIN"]),
    coachId: z.string().nullable().optional(),
});

export async function PATCH(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actor = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!actor || actor.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { userId: targetId, role, coachId } = parsed.data;

    let assignedCoachId: string | null = null;
    if (role === "PREMIUM" && coachId) {
        const coach = await prisma.user.findUnique({
            where: { id: coachId },
            select: { id: true, role: true },
        });
        const coachDeactivated = coach ? await getUserDeactivationStatusById(coach.id) : false;
        if (!coach || coachDeactivated || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
            return NextResponse.json({ error: "Invalid coach assignment" }, { status: 400 });
        }
        assignedCoachId = coach.id;
    }

    // When promoting to COACH: enforce restrictions
    // - coaches must NOT have active plans
    // - coaches must NOT have goal data
    if (role === "COACH" || role === "SUPER_ADMIN") {
        await prisma.$transaction(async (tx) => {
            // Deactivate all plans for this user
            await tx.userPlan.updateMany({
                where: { userId: targetId },
                data: { isActive: false },
            });
            // Clear goal-related onboarding fields
            await tx.user.update({
                where: { id: targetId },
                data: {
                    goal: null,
                    coachId: null,
                },
            });
        });
    }

    await prisma.user.update({
        where: { id: targetId },
        data: {
            role: role as never,
            coachId: role === "PREMIUM" ? assignedCoachId : null,
        },
    });
    await setUserDeactivationStatus(targetId, false);

    return NextResponse.json({ success: true });
}
