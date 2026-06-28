import { prisma } from "@/lib/prisma";

let planOriginalCreatorReady = false;

/** Ensures plans track the first person who created the programme (unchanged on copy). */
export async function ensurePlanOriginalCreatorColumn() {
    if (planOriginalCreatorReady) return;

    await prisma.$executeRaw`
        ALTER TABLE "plans"
        ADD COLUMN IF NOT EXISTS "originalCreatorId" TEXT
    `;

    await prisma.$executeRaw`
        UPDATE "plans"
        SET "originalCreatorId" = "creatorId"
        WHERE "originalCreatorId" IS NULL AND "creatorId" IS NOT NULL
    `;

    planOriginalCreatorReady = true;
}

export function resolvePlanOriginalCreatorId(plan: {
    originalCreatorId?: string | null;
    creatorId?: string | null;
}): string | null {
    return plan.originalCreatorId ?? plan.creatorId ?? null;
}
