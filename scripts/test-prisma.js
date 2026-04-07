const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
        console.log(JSON.stringify(users, null, 2));
    } catch (e) {
        console.error("ERROR: ", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
