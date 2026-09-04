import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Historic script — PHOENIX is permanently blocked and must never grant a role. */
async function main() {
    const result = await prisma.accessCode.updateMany({
        where: { code: "PHOENIX" },
        data: { isActive: false, status: "expired" },
    });

    console.log(`PHOENIX access is blocked. Deactivated rows: ${result.count}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
