import type { Prisma, PrismaClient, Role } from "@prisma/client";
import { getAccessCodePrefix } from "@/lib/utils";

export async function generateCoachAccessCode(
    prisma: PrismaClient,
    coach: { name?: string | null; email?: string | null }
) {
    const prefix = getAccessCodePrefix(coach.name, coach.email);
    const numberDigits = Math.max(3, 6 - prefix.length);
    const min = 10 ** (numberDigits - 1);
    const range = 9 * min;

    for (let i = 0; i < 8; i++) {
        const number = Math.floor(min + Math.random() * range);
        const code = `${prefix}${number}`;
        const existing = await prisma.accessCode.findUnique({ where: { code } });
        if (!existing) return code;
    }

    const fallback = `${prefix}${Date.now().toString().slice(-6)}`;
    const existing = await prisma.accessCode.findUnique({ where: { code: fallback } });
    return existing ? `${prefix}${Date.now()}` : fallback;
}

export async function redeemAccessCodeForUser(
    prisma: PrismaClient,
    user: { id: string },
    rawCode: string
) {
    const code = rawCode.trim().toUpperCase();
    const validation = await validateAccessCode(prisma, code);
    if ("error" in validation) return validation;
    const accessCode = validation.accessCode;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.accessCode.update({
            where: { id: accessCode.id },
            data: { usedById: user.id, usedAt: new Date(), isActive: false },
        });

        await tx.user.update({
            where: { id: user.id },
            data: {
                role: accessCode.upgradesTo as Role,
                coachId: accessCode.generatedBy,
            },
        });

        if (accessCode.planId) {
            const existing = await tx.userPlan.findUnique({
                where: { userId_planId: { userId: user.id, planId: accessCode.planId } },
            });
            if (!existing) {
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

    return {
        success: true,
        upgradedTo: accessCode.upgradesTo,
        planAssigned: !!accessCode.planId,
    } as const;
}

export async function validateAccessCode(prisma: PrismaClient, rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    const accessCode = await prisma.accessCode.findUnique({
        where: { code },
        include: { generator: { select: { name: true, email: true } } },
    });

    if (!accessCode) return { error: "Invalid code", status: 404 } as const;
    if (!accessCode.isActive) return { error: "Code already used", status: 400 } as const;
    if (accessCode.usedById) return { error: "Code already redeemed", status: 400 } as const;
    if (accessCode.expiresAt && accessCode.expiresAt < new Date()) {
        return { error: "Code has expired", status: 400 } as const;
    }

    return { success: true, accessCode } as const;
}
