/**
 * Plural exercise names merged into their singular canonical form.
 * Used by seed dictionary filtering and DB merge script.
 */
const EXERCISE_PLURAL_MERGES = [
    ["Barbell Bicep Curls", "Barbell Bicep Curl"],
    ["Barbell Curls", "Barbell Curl"],
    ["Barbell Rows", "Barbell Row"],
    ["Barbell Squats", "Barbell Squat"],
    ["Bicycle Crunches", "Bicycle Crunch"],
    ["Box Jumps", "Box Jump"],
    ["Bulgarian Split Squats", "Bulgarian Split Squat"],
    ["Burpees", "Burpee"],
    ["Cable Crunches", "Cable Crunch"],
    ["Calf Raises", "Calf Raise"],
    ["Chin-Ups", "Chin-Up"],
    ["Crunches", "Crunch"],
    ["Dips", "Dip"],
    ["Dumbbell Curls", "Dumbbell Curl"],
    ["Dumbbell Lateral Raises", "Dumbbell Lateral Raise"],
    ["Face Pulls", "Face Pull"],
    ["Hammer Curls", "Hammer Curl"],
    ["Hanging Knee Raises", "Hanging Knee Raise"],
    ["Hanging Leg Raises", "Hanging Leg Raise"],
    ["Hill Sprints", "Hill Sprint"],
    ["Hip Thrusts", "Hip Thrust"],
    ["Jumping Jacks", "Jumping Jack"],
    ["Lat Pulldowns", "Lat Pulldown"],
    ["Lateral Raises", "Lateral Raise"],
    ["Leg Curls", "Leg Curl"],
    ["Leg Extensions", "Leg Extension"],
    ["Lunges", "Lunge"],
    ["Mountain Climbers", "Mountain Climber"],
    ["Planks", "Plank"],
    ["Preacher Curls", "Preacher Curl"],
    ["Pull-Ups", "Pull-Up"],
    ["Renegade Rows", "Renegade Row"],
    ["Reverse Lunges", "Reverse Lunge"],
    ["Russian Twists", "Russian Twist"],
    ["Seated Cable Rows", "Seated Cable Row"],
    ["Seated Calf Raises", "Seated Calf Raise"],
    ["Sit Ups", "Sit Up"],
    ["Sit-Ups", "Sit-Up"],
    ["Skull Crushers", "Skull Crusher"],
    ["Sprints", "Sprint"],
    ["Squats", "Squat"],
    ["Step Ups", "Step Up"],
    ["Tricep Kickbacks", "Tricep Kickback"],
    ["Tricep Pushdowns", "Tricep Pushdown"],
    ["Walking Lunges", "Walking Lunge"],
    ["Wall Balls", "Wall Ball"],
];

const PLURAL_TO_SINGULAR = new Map(EXERCISE_PLURAL_MERGES);
const PLURAL_NAMES_TO_REMOVE = new Set(EXERCISE_PLURAL_MERGES.map(([plural]) => plural));

function canonicalExerciseName(name) {
    return PLURAL_TO_SINGULAR.get(name) ?? name;
}

module.exports = {
    EXERCISE_PLURAL_MERGES,
    PLURAL_TO_SINGULAR,
    PLURAL_NAMES_TO_REMOVE,
    canonicalExerciseName,
};
