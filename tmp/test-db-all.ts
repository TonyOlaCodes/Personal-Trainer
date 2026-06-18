import { prisma } from "../src/lib/prisma";

async function main() {
    try {
        console.log("1. Querying users...");
        const users = await prisma.user.findMany({ take: 5 });
        console.log(`Success! Found ${users.length} users.`);

        console.log("2. Querying check-ins...");
        const checkins = await prisma.checkIn.findMany({ take: 5 });
        console.log(`Success! Found ${checkins.length} check-ins.`);

        console.log("3. Querying messages...");
        const messages = await prisma.message.findMany({ take: 5 });
        console.log(`Success! Found ${messages.length} messages.`);

        console.log("4. Querying plans...");
        const plans = await prisma.plan.findMany({ take: 5 });
        console.log(`Success! Found ${plans.length} plans.`);

        console.log("DB check completed successfully. All core tables accessible.");
    } catch (e) {
        console.error("DB check failed with error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
