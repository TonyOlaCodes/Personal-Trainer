const { PrismaClient } = require("@prisma/client");
const { EXERCISES } = require("./exerciseDictionary");

const prisma = new PrismaClient();

async function main() {
    console.log(`Seeding ${EXERCISES.length} exercises into global dictionary...`);
    let seededCount = 0;

    for (const ex of EXERCISES) {
        try {
            await prisma.globalExercise.upsert({
                where: { name: ex.name },
                update: {
                    muscleGroup: ex.muscleGroup,
                    ...(ex.videoUrl ? { videoUrl: ex.videoUrl } : {}),
                    ...(ex.instructions ? { instructions: ex.instructions } : {}),
                    ...(ex.thumbnailUrl ? { thumbnailUrl: ex.thumbnailUrl } : {}),
                },
                create: {
                    name: ex.name,
                    muscleGroup: ex.muscleGroup,
                    videoUrl: ex.videoUrl ?? null,
                    instructions: ex.instructions ?? `Targets: ${ex.muscleGroup}`,
                    thumbnailUrl: ex.thumbnailUrl ?? null,
                },
            });
            seededCount++;
        } catch (err) {
            console.error(`Failed to seed: ${ex.name}`, err.message);
        }
    }

    console.log(`Done. Seeded/updated ${seededCount} exercises.`);
}

main()
    .catch((e) => {
        console.error("Uncaught error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
