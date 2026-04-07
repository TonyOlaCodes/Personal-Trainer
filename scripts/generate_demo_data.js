const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'tonyolajide@gmail.com';
  console.log(`Checking user: ${email}...`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      plans: {
        include: {
          plan: {
            include: {
              weeks: {
                include: {
                  workouts: {
                    include: {
                      exercises: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    return;
  }

  console.log(`User found: ${user.name} (ID: ${user.id})`);

  // Clear existing logs and check-ins for this user to avoid duplicates and ensure a fresh demo
  console.log("Cleaning up existing demo data...");
  await prisma.logSet.deleteMany({ where: { workoutLog: { userId: user.id } } });
  await prisma.workoutLog.deleteMany({ where: { userId: user.id } });
  await prisma.checkIn.deleteMany({ where: { userId: user.id } });

  // Find a PPL plan if none is active
  let activeUserPlan = user.plans.find(p => p.isActive);
  if (!activeUserPlan) {
    console.log("No active plan found, looking for a PPL plan...");
    const pplPlan = await prisma.plan.findFirst({
      where: { name: { contains: 'PPL', mode: 'insensitive' } },
      include: { weeks: { include: { workouts: { include: { exercises: true } } } } }
    });

    if (pplPlan) {
      console.log(`Found PPL plan: ${pplPlan.name}. Assigning to user...`);
      activeUserPlan = await prisma.userPlan.upsert({
        where: { userId_planId: { userId: user.id, planId: pplPlan.id } },
        update: { isActive: true },
        create: { userId: user.id, planId: pplPlan.id, isActive: true }
      });
      activeUserPlan.plan = pplPlan;
    } else if (user.plans.length > 0) {
      activeUserPlan = user.plans[0];
      console.log(`No PPL plan found in system. Using user's first plan: ${activeUserPlan.plan.name}`);
    }
  }

  if (!activeUserPlan || !activeUserPlan.plan) {
    console.error("No suitable plan found. Please create a PPL plan or assign one manually first.");
    return;
  }

  const plan = activeUserPlan.plan;
  console.log(`Using plan: ${plan.name} (PlanID: ${plan.id})`);

  // Generate data for 8 weeks
  const today = new Date();
  const weeksCount = 8;

  // Let's create weights for the past 60 days
  console.log("Generating weight data...");
  for (let i = 0; i < 60; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Slight trend: start heavier, end lighter (losing weight)
    const baseWeight = 85.0;
    const trend = (60 - i) * 0.05; // 3kg loss over 2 months
    const noise = (Math.random() - 0.5) * 0.5;
    const weight = baseWeight + trend + noise;

    // We can put these into CheckIns or just ensure we have weight entries
    // Since CheckIns are weekly, let's create 8 weekly check-ins
    if (i % 7 === 0) {
      const weekNum = Math.floor((60 - i) / 7);
      await prisma.checkIn.create({
         data: {
            userId: user.id,
            weekNumber: weekNum,
            bodyweightKg: weight,
            status: 'REVIEWED',
            createdAt: date,
            sleepRating: 4,
            dietRating: 5,
            stressRating: 2,
            energyRating: 4,
            feedback: "Feeling strong and lean!",
            coachResponse: "Great progress on the weight loss. Keep it up!"
         }
      });
    }
  }

  // Generate workout logs
  console.log("Generating workout logs...");
  // PPL has 3-6 workouts per week. Let's assume 4 workouts/week.
  const week1 = plan.weeks[0] || { workouts: [] };
  const workouts = week1.workouts;

  if (workouts.length === 0) {
    console.error("No workouts found in the plan's first week.");
    return;
  }

  for (let w = 1; w <= weeksCount; w++) {
    for (let d = 0; d < workouts.length; d++) {
        const workout = workouts[d];
        const date = new Date(today);
        date.setDate(date.getDate() - (weeksCount - w) * 7 - (7 - d));
        
        if (date > today) continue;

        const duration = 45 + Math.floor(Math.random() * 30);
        const feeling = 3 + Math.floor(Math.random() * 3);

        const log = await prisma.workoutLog.create({
            data: {
                userId: user.id,
                workoutId: workout.id,
                loggedAt: date,
                duration,
                feeling,
                status: 'COMPLETED',
                notes: `Completed week ${w} session ${d+1}. Feeling good.`,
            }
        });

        // Create sets for each exercise
        for (const ex of workout.exercises) {
            // Linear progression: increase weight every week
            const startWeight = ex.weightTargetKg || 40;
            const weekProgression = (w - 1) * 2.5; // +2.5kg per week
            const exerciseWeight = startWeight + weekProgression;

            for (let s = 1; s <= ex.sets; s++) {
                await prisma.logSet.create({
                    data: {
                        workoutLogId: log.id,
                        exerciseId: ex.id,
                        setNumber: s,
                        reps: parseInt(ex.reps.split('-')[0]) || 10,
                        weightKg: exerciseWeight,
                        isPR: w === weeksCount && s === 1, // Mark last week as PR
                    }
                });
            }
        }
    }
  }

  console.log("Demo data generation complete!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
