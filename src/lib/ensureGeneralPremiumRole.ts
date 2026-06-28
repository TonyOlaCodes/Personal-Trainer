import { prisma } from "@/lib/prisma";

let generalPremiumRoleReady = false;

/** Add GENERAL_PREMIUM to the Role enum on existing databases. */
export async function ensureGeneralPremiumRole() {
    if (generalPremiumRoleReady) return;

    await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
            ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'GENERAL_PREMIUM';
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `);

    generalPremiumRoleReady = true;
}
