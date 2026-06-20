const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function test() {
    try {
        const user = await prisma.user.findFirst({
            include: {
                plans: {
                    where: { isActive: true },
                    include: {
                        plan: {
                            include: {
                                weeks: {
                                    orderBy: { weekNumber: "asc" },
                                    include: {
                                        workouts: {
                                            orderBy: { dayNumber: "asc" },
                                            include: { exercises: { where: { isCustom: false }, orderBy: { order: "asc" } } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    take: 1,
                },
                workoutLogs: {
                    orderBy: { loggedAt: "desc" },
                    take: 20,
                    include: { workout: true, sets: true },
                },
            },
        });
        console.log("Success! user id:", user?.id);
    } catch(e) {
        console.error("Prisma Error:", e);
    }
}
test();
