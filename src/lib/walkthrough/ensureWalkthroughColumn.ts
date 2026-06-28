import { prisma } from "@/lib/prisma";

let walkthroughColumnReady = false;

export async function ensureWalkthroughColumn() {
    if (walkthroughColumnReady) return;

    await prisma.$executeRaw`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "walkthroughDone" BOOLEAN NOT NULL DEFAULT false
    `;

    walkthroughColumnReady = true;
}

export function shouldOfferClientWalkthrough(role: string, walkthroughDone: boolean): boolean {
    return (role === "FREE" || role === "PREMIUM" || role === "GENERAL_PREMIUM") && !walkthroughDone;
}
