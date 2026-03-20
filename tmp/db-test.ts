import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    try {
        const users = await prisma.user.findMany({ take: 1 });
        console.log("DB Connection OK. Users found:", users.length);
    } catch (e) {
        console.error("DB Connection FAILED:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
