import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

let schemaInitialized = false;
export async function ensureDbSchema() {
    if (schemaInitialized) return;
    try {
        await prisma.$executeRaw`
            ALTER TABLE "exercises"
            ADD COLUMN IF NOT EXISTS "isCustom" BOOLEAN DEFAULT false
        `;
        schemaInitialized = true;
    } catch (e) {
        console.warn("[ensureDbSchema] Failed to verify schema:", e);
    }
}

