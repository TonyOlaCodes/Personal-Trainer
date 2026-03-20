import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// POST redeem an access code
export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { code } = z.object({ code: z.string().min(1) }).parse(await req.json());

    const accessCode = await prisma.accessCode.findUnique({ where: { code: code.toUpperCase() } });

    if (!accessCode) return NextResponse.json({ error: "Invalid code" }, { status: 404 });
    if (!accessCode.isActive) return NextResponse.json({ error: "Code already used" }, { status: 400 });
    if (accessCode.usedById) return NextResponse.json({ error: "Code already redeemed" }, { status: 400 });
    if (accessCode.expiresAt && accessCode.expiresAt < new Date()) {
        return NextResponse.json({ error: "Code has expired" }, { status: 400 });
    }

    // Run in transaction: mark code used + upgrade user + assign plan
    await prisma.$transaction(async (tx) => {
        // Mark code used
        await tx.accessCode.update({
            where: { id: accessCode.id },
            data: { usedById: user.id, usedAt: new Date(), isActive: false },
        });

        // Upgrade user role and assign coach
        await tx.user.update({
            where: { id: user.id },
            data: { 
                role: accessCode.upgradesTo as never,
                coachId: accessCode.generatedBy // Assign the coach who made the code
            },
        });

        // Assign plan if code has one
        if (accessCode.planId) {
            const existing = await tx.userPlan.findUnique({
                where: { userId_planId: { userId: user.id, planId: accessCode.planId } },
            });
            if (!existing) {
                // Deactivate all current plans then set new one as active
                await tx.userPlan.updateMany({
                    where: { userId: user.id },
                    data: { isActive: false },
                });
                await tx.userPlan.create({
                    data: { userId: user.id, planId: accessCode.planId, isActive: true },
                });
            }
        }
    });

    return NextResponse.json({ success: true, upgradedTo: accessCode.upgradesTo, planAssigned: !!accessCode.planId });
}
