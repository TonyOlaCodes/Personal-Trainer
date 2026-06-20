const { PrismaClient } = require('@prisma/client');

const email = process.argv[2];
const role = process.argv[3] || 'SUPER_ADMIN';

if (!email) {
    console.error('Usage: node scripts/set-admin.js <email> [role]');
    process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
        console.error(`No user found with email: ${email}`);
        process.exit(1);
    }

    const updated = await prisma.user.update({
        where: { email },
        data: { role },
        select: { id: true, email: true, name: true, role: true },
    });

    console.log('Updated user:', updated);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
