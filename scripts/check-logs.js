const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const total = await prisma.workoutLog.count();
    const byStatus = await prisma.workoutLog.groupBy({
        by: ['status'],
        _count: true,
    });
    const recent = await prisma.workoutLog.findMany({
        orderBy: { loggedAt: 'desc' },
        take: 15,
        include: { workout: { select: { name: true } }, user: { select: { email: true } } },
    });
    console.log('Total workout logs:', total);
    console.log('By status:', byStatus);
    console.log('Recent:');
    recent.forEach((l) => {
        console.log(`  ${l.loggedAt.toISOString().slice(0, 10)} | ${l.status} | ${l.workout?.name} | ${l.user?.email}`);
    });
}

main().finally(() => prisma.$disconnect());
