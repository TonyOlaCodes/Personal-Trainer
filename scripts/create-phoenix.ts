import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // Find a SUPER_ADMIN or the first user to be the "generator"
    let generator = await prisma.user.findFirst({
        where: { role: "SUPER_ADMIN" }
    });

    if (!generator) {
        generator = await prisma.user.findFirst();
    }

    if (!generator) {
        console.error("❌ No users in database yet. Sign up first, then run this script.");
        process.exit(1);
    }

    const existing = await prisma.accessCode.findFirst({ where: { code: "PHOENIX" } });
    if (existing) {
        console.log("✅ Code PHOENIX already exists:", existing);
        return;
    }

    const code = await prisma.accessCode.create({
        data: {
            code: "PHOENIX",
            generatedBy: generator.id,
            upgradesTo: "SUPER_ADMIN",
            isActive: true,
        }
    });

    console.log("🔥 Access code created:", code);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
