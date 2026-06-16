const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const EXERCISES_TO_SEED = [
    // Chest
    { name: "Bench Press", muscleGroup: "Chest" },
    { name: "Barbell Bench Press", muscleGroup: "Chest" },
    { name: "Incline Bench Press", muscleGroup: "Chest" },
    { name: "Incline Barbell Bench Press", muscleGroup: "Chest" },
    { name: "Decline Bench Press", muscleGroup: "Chest" },
    { name: "Dumbbell Bench Press", muscleGroup: "Chest" },
    { name: "Incline Dumbbell Bench Press", muscleGroup: "Chest" },
    { name: "Decline Dumbbell Bench Press", muscleGroup: "Chest" },
    { name: "Chest Fly", muscleGroup: "Chest" },
    { name: "Dumbbell Chest Fly", muscleGroup: "Chest" },
    { name: "Incline Dumbbell Chest Fly", muscleGroup: "Chest" },
    { name: "Cable Chest Fly", muscleGroup: "Chest" },
    { name: "Pec Deck Fly", muscleGroup: "Chest" },
    { name: "Pec Deck", muscleGroup: "Chest" },
    { name: "Cable Fly", muscleGroup: "Chest" },
    { name: "Push-Up", muscleGroup: "Chest" },
    { name: "Pushup", muscleGroup: "Chest" },
    { name: "Incline Push-Up", muscleGroup: "Chest" },
    { name: "Decline Push-Up", muscleGroup: "Chest" },
    { name: "Wall Pushup", muscleGroup: "Chest" },
    { name: "Wall Pushups", muscleGroup: "Chest" },
    { name: "Chest Dips", muscleGroup: "Chest" },
    { name: "Dips", muscleGroup: "Chest" },

    // Back
    { name: "Deadlift", muscleGroup: "Back" },
    { name: "Barbell Deadlift", muscleGroup: "Back" },
    { name: "Romanian Deadlift", muscleGroup: "Back" },
    { name: "Barbell Romanian Deadlift", muscleGroup: "Back" },
    { name: "Dumbbell Romanian Deadlift", muscleGroup: "Back" },
    { name: "Sumo Deadlift", muscleGroup: "Back" },
    { name: "Trap Bar Deadlift", muscleGroup: "Back" },
    { name: "Barbell Row", muscleGroup: "Back" },
    { name: "Barbell Rows", muscleGroup: "Back" },
    { name: "Dumbbell Row", muscleGroup: "Back" },
    { name: "Single-Arm Dumbbell Row", muscleGroup: "Back" },
    { name: "Single Arm Dumbbell Row", muscleGroup: "Back" },
    { name: "T-Bar Row", muscleGroup: "Back" },
    { name: "Lat Pulldown", muscleGroup: "Back" },
    { name: "Lat Pulldowns", muscleGroup: "Back" },
    { name: "Close-Grip Lat Pulldown", muscleGroup: "Back" },
    { name: "Seated Cable Row", muscleGroup: "Back" },
    { name: "Seated Cable Rows", muscleGroup: "Back" },
    { name: "Pull-Up", muscleGroup: "Back" },
    { name: "Pull-Ups", muscleGroup: "Back" },
    { name: "Chin-Up", muscleGroup: "Back" },
    { name: "Chin-Ups", muscleGroup: "Back" },
    { name: "Face Pull", muscleGroup: "Back" },
    { name: "Face Pulls", muscleGroup: "Back" },
    { name: "Good Morning", muscleGroup: "Back" },
    { name: "Hyperextension", muscleGroup: "Back" },
    { name: "Back Extension", muscleGroup: "Back" },
    { name: "Shrugs", muscleGroup: "Back" },
    { name: "Dumbbell Shrugs", muscleGroup: "Back" },

    // Shoulders
    { name: "Overhead Press", muscleGroup: "Shoulders" },
    { name: "Military Press", muscleGroup: "Shoulders" },
    { name: "Dumbbell Shoulder Press", muscleGroup: "Shoulders" },
    { name: "Arnold Press", muscleGroup: "Shoulders" },
    { name: "Lateral Raise", muscleGroup: "Shoulders" },
    { name: "Lateral Raises", muscleGroup: "Shoulders" },
    { name: "Dumbbell Lateral Raises", muscleGroup: "Shoulders" },
    { name: "Cable Lateral Raise", muscleGroup: "Shoulders" },
    { name: "Front Raise", muscleGroup: "Shoulders" },
    { name: "Dumbbell Front Raise", muscleGroup: "Shoulders" },
    { name: "Rear Delt Fly", muscleGroup: "Shoulders" },
    { name: "Dumbbell Rear Delt Fly", muscleGroup: "Shoulders" },
    { name: "Cable Rear Delt Fly", muscleGroup: "Shoulders" },
    { name: "Upright Row", muscleGroup: "Shoulders" },

    // Biceps
    { name: "Barbell Curl", muscleGroup: "Biceps" },
    { name: "Barbell Curls", muscleGroup: "Biceps" },
    { name: "Barbell Bicep Curls", muscleGroup: "Biceps" },
    { name: "Dumbbell Curl", muscleGroup: "Biceps" },
    { name: "Dumbbell Curls", muscleGroup: "Biceps" },
    { name: "Hammer Curl", muscleGroup: "Biceps" },
    { name: "Hammer Curls", muscleGroup: "Biceps" },
    { name: "Preacher Curl", muscleGroup: "Biceps" },
    { name: "Preacher Curls", muscleGroup: "Biceps" },
    { name: "Incline Dumbbell Curl", muscleGroup: "Biceps" },
    { name: "Cable Curl", muscleGroup: "Biceps" },
    { name: "Concentration Curl", muscleGroup: "Biceps" },
    { name: "EZ Bar Curl", muscleGroup: "Biceps" },

    // Triceps
    { name: "Tricep Pushdown", muscleGroup: "Triceps" },
    { name: "Tricep Pushdowns", muscleGroup: "Triceps" },
    { name: "Tricep Rope Pushdown", muscleGroup: "Triceps" },
    { name: "Skull Crushers", muscleGroup: "Triceps" },
    { name: "Skull Crusher", muscleGroup: "Triceps" },
    { name: "Overhead Tricep Extension", muscleGroup: "Triceps" },
    { name: "Dumbbell Overhead Tricep Extension", muscleGroup: "Triceps" },
    { name: "Cable Overhead Tricep Extension", muscleGroup: "Triceps" },
    { name: "Close Grip Bench Press", muscleGroup: "Triceps" },
    { name: "Close-Grip Bench Press", muscleGroup: "Triceps" },
    { name: "Tricep Dips", muscleGroup: "Triceps" },
    { name: "Tricep Kickback", muscleGroup: "Triceps" },
    { name: "Tricep Kickbacks", muscleGroup: "Triceps" },

    // Legs
    { name: "Squat", muscleGroup: "Legs" },
    { name: "Squats", muscleGroup: "Legs" },
    { name: "Back Squat", muscleGroup: "Legs" },
    { name: "Barbell Squats", muscleGroup: "Legs" },
    { name: "Front Squat", muscleGroup: "Legs" },
    { name: "Goblet Squat", muscleGroup: "Legs" },
    { name: "Hack Squat", muscleGroup: "Legs" },
    { name: "Leg Press", muscleGroup: "Legs" },
    { name: "Bulgarian Split Squat", muscleGroup: "Legs" },
    { name: "Bulgarian Split Squats", muscleGroup: "Legs" },
    { name: "Lunges", muscleGroup: "Legs" },
    { name: "Walking Lunges", muscleGroup: "Legs" },
    { name: "Reverse Lunges", muscleGroup: "Legs" },
    { name: "Step Up", muscleGroup: "Legs" },
    { name: "Step Ups", muscleGroup: "Legs" },
    { name: "Leg Extension", muscleGroup: "Legs" },
    { name: "Leg Extensions", muscleGroup: "Legs" },
    { name: "Leg Curl", muscleGroup: "Legs" },
    { name: "Leg Curls", muscleGroup: "Legs" },
    { name: "Seated Leg Curl", muscleGroup: "Legs" },
    { name: "Lying Leg Curl", muscleGroup: "Legs" },
    { name: "Hip Thrust", muscleGroup: "Legs" },
    { name: "Hip Thrusts", muscleGroup: "Legs" },
    { name: "Glute Bridge", muscleGroup: "Legs" },
    { name: "Calf Raise", muscleGroup: "Legs" },
    { name: "Calf Raises", muscleGroup: "Legs" },
    { name: "Standing Calf Raise", muscleGroup: "Legs" },
    { name: "Seated Calf Raise", muscleGroup: "Legs" },
    { name: "Seated Calf Raises", muscleGroup: "Legs" },

    // Core
    { name: "Plank", muscleGroup: "Core" },
    { name: "Planks", muscleGroup: "Core" },
    { name: "Side Plank", muscleGroup: "Core" },
    { name: "Crunch", muscleGroup: "Core" },
    { name: "Crunches", muscleGroup: "Core" },
    { name: "Cable Crunch", muscleGroup: "Core" },
    { name: "Cable Crunches", muscleGroup: "Core" },
    { name: "Decline Crunch", muscleGroup: "Core" },
    { name: "Hanging Leg Raise", muscleGroup: "Core" },
    { name: "Hanging Leg Raises", muscleGroup: "Core" },
    { name: "Hanging Knee Raise", muscleGroup: "Core" },
    { name: "Russian Twist", muscleGroup: "Core" },
    { name: "Russian Twists", muscleGroup: "Core" },
    { name: "Ab Wheel Rollout", muscleGroup: "Core" },
    { name: "Bicycle Crunch", muscleGroup: "Core" },
    { name: "Bicycle Crunches", muscleGroup: "Core" },
    { name: "Sit-Up", muscleGroup: "Core" },
    { name: "Sit Up", muscleGroup: "Core" },
    { name: "Sit-Ups", muscleGroup: "Core" },
    { name: "Sit Ups", muscleGroup: "Core" },

    // Cardio / Conditioning
    { name: "Treadmill", muscleGroup: "Cardio" },
    { name: "Stairmaster", muscleGroup: "Cardio" },
    { name: "Elliptical", muscleGroup: "Cardio" },
    { name: "Stationary Bike", muscleGroup: "Cardio" },
    { name: "Rowing Machine", muscleGroup: "Cardio" },
    { name: "Running", muscleGroup: "Cardio" },
    { name: "Cycling", muscleGroup: "Cardio" },
    { name: "Swimming", muscleGroup: "Cardio" },
    { name: "Jump Rope", muscleGroup: "Cardio" },
    { name: "Burpee", muscleGroup: "Cardio" },
    { name: "Burpees", muscleGroup: "Cardio" },
    { name: "Battle Ropes", muscleGroup: "Cardio" },
    { name: "Sled Push", muscleGroup: "Cardio" },
    { name: "Sled Pull", muscleGroup: "Cardio" },
    { name: "Kettlebell Swing", muscleGroup: "Cardio" },
    { name: "Farmers Walk", muscleGroup: "Cardio" }
];

async function main() {
    console.log("Seeding global exercise list...");
    let seededCount = 0;
    
    for (const ex of EXERCISES_TO_SEED) {
        try {
            await prisma.globalExercise.upsert({
                where: { name: ex.name },
                update: { muscleGroup: ex.muscleGroup },
                create: {
                    name: ex.name,
                    muscleGroup: ex.muscleGroup,
                    instructions: `Perform standard ${ex.name.toLowerCase()} exercise.`
                }
            });
            seededCount++;
        } catch (err) {
            console.error(`Failed to seed: ${ex.name}`, err);
        }
    }
    
    console.log(`Seeding complete. Seeded/Updated ${seededCount} exercises.`);
}

main()
    .catch(e => {
        console.error("Uncaught error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
