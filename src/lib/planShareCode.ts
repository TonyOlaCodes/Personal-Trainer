import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export async function generateUniquePlanShareCode(): Promise<string> {
    for (let attempt = 0; attempt < 25; attempt++) {
        const candidate = randomBytes(4).toString("hex").toUpperCase();
        const existing = await prisma.plan.findUnique({
            where: { shareCode: candidate },
            select: { id: true },
        });
        if (!existing) return candidate;
    }
    throw new Error("Could not generate unique plan share code");
}

/** Assign a share code when missing (legacy/copied plans). */
export async function ensurePlanShareCode(planId: string): Promise<string> {
    const plan = await prisma.plan.findUnique({
        where: { id: planId },
        select: { shareCode: true },
    });
    if (!plan) throw new Error("Plan not found");
    if (plan.shareCode) return plan.shareCode;

    const shareCode = await generateUniquePlanShareCode();
    await prisma.plan.update({
        where: { id: planId },
        data: { shareCode },
    });
    return shareCode;
}

/** Backfill missing share codes for a set of plans. */
export async function ensurePlansShareCodes(planIds: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(planIds)];
    if (uniqueIds.length === 0) return new Map();

    const plans = await prisma.plan.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, shareCode: true },
    });

    const codes = new Map<string, string>();
    await Promise.all(plans.map(async (plan) => {
        const code = plan.shareCode ?? await ensurePlanShareCode(plan.id);
        codes.set(plan.id, code);
    }));
    return codes;
}
