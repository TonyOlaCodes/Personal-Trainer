import type { Prisma, PrismaClient, Role } from "@prisma/client";

export async function generateCoachAccessCode(
    prisma: PrismaClient,
    coach: { name?: string | null; email?: string | null }
) {
    // Get first 4 letters of coach's name (case-insensitive uppercase).
    // Strip non-alphabetic characters. Fall back to email name if name is too short.
    let letters = (coach.name || "").replace(/[^a-zA-Z]/g, "").toUpperCase();
    if (letters.length < 4) {
        const emailLetters = (coach.email || "").split("@")[0].replace(/[^a-zA-Z]/g, "").toUpperCase();
        letters = (letters + emailLetters).toUpperCase();
    }
    if (letters.length < 4) {
        letters = (letters + "COACH").toUpperCase();
    }
    const prefix = letters.slice(0, 4);

    // Retrieve all existing codes starting with prefix to avoid multiple DB calls
    const existingCodes = await prisma.accessCode.findMany({
        where: {
            code: {
                startsWith: prefix,
            },
        },
        select: { code: true },
    });

    const existingSet = new Set(existingCodes.map((c) => c.code.toUpperCase()));

    // Generate unique code: prefix + 3 digits (000 to 999)
    const possibleNumbers = Array.from({ length: 1000 }, (_, i) => i);

    while (possibleNumbers.length > 0) {
        const randomIndex = Math.floor(Math.random() * possibleNumbers.length);
        const num = possibleNumbers[randomIndex];
        const candidate = `${prefix}${num.toString().padStart(3, "0")}`;

        if (!existingSet.has(candidate)) {
            return candidate;
        }

        // Remove the tried option
        possibleNumbers.splice(randomIndex, 1);
    }

    throw new Error(`All unique access codes for prefix '${prefix}' have been exhausted.`);
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
