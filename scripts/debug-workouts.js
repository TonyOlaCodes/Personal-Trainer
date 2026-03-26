const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
    const workouts = await p.workout.findMany({ take: 3, include: { exercises: { take: 1 } } });
    console.log('WORKOUTS:', JSON.stringify(workouts.map(w => ({ id: w.id, name: w.name, exerciseCount: w.exercises.length })), null, 2));
    const users = await p.user.findMany({ take: 2, include: { plans: { where: { isActive: true }, include: { plan: { include: { weeks: { include: { workouts: { include: { exercises: { take: 1 } } } } } } } } } } });
    users.forEach(u => {
        const plan = u.plans[0]?.plan;
        if (plan) {
            const workouts = plan.weeks.flatMap(w => w.workouts);
            console.log(`USER ${u.email}: plan="${plan.name}" workouts=[${workouts.map(w => w.id + '/' + w.name)}]`);
        } else {
            console.log(`USER ${u.email}: NO ACTIVE PLAN`);
        }
    });
}
main().catch(console.error).finally(() => p.$disconnect());
