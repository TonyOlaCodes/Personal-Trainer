const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.user.findFirst();
        if (user) {
            console.log(JSON.stringify(Object.keys(user), null, 2));
        } else {
            console.log("No users found.");
        }
    } catch (e) {
        console.error("ERROR: ", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
