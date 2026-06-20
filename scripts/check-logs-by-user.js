const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    for (const user of users) {
        const count = await prisma.workoutLog.count({ where: { userId: user.id } });
        const completed = await prisma.workoutLog.count({ where: { userId: user.id, status: 'COMPLETED' } });
        console.log(`${user.email}: ${completed} completed / ${count} total`);
    }
}

main().finally(() => prisma.$disconnect());
