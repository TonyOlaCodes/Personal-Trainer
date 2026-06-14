export interface TemplateExercise {
    name: string;
    sets: number;
    reps: string;
}

export interface TemplateWorkout {
    name: string;
    dayNumber: number;
    exercises: TemplateExercise[];
}

export interface Template {
    id: string;
    name: string;
    description: string;
    workouts: TemplateWorkout[];
}

const broSplitWorkouts: TemplateWorkout[] = [
    {
        name: "Chest",
        dayNumber: 1,
        exercises: [
            { name: "Bench Press", sets: 4, reps: "6-8" },
            { name: "Incline Dumbbell Press", sets: 3, reps: "8-10" },
            { name: "Chest Fly", sets: 3, reps: "10-12" },
            { name: "Cable Crossover", sets: 3, reps: "12-15" },
            { name: "Push Ups", sets: 2, reps: "AMRAP" },
        ],
    },
    {
        name: "Back",
        dayNumber: 2,
        exercises: [
            { name: "Pull Ups", sets: 4, reps: "6-8" },
            { name: "Barbell Row", sets: 3, reps: "8-10" },
            { name: "Lat Pulldown", sets: 3, reps: "10-12" },
            { name: "Seated Row", sets: 3, reps: "10-12" },
            { name: "Face Pull", sets: 3, reps: "12-15" },
        ],
    },
    {
        name: "Shoulders",
        dayNumber: 3,
        exercises: [
            { name: "Overhead Press", sets: 4, reps: "6-8" },
            { name: "Lateral Raise", sets: 4, reps: "10-12" },
            { name: "Rear Delt Fly", sets: 3, reps: "12-15" },
            { name: "Cable Lateral Raise", sets: 3, reps: "12-15" },
            { name: "Shrugs", sets: 3, reps: "10-12" },
        ],
    },
    {
        name: "Arms",
        dayNumber: 4,
        exercises: [
            { name: "Barbell Curl", sets: 3, reps: "8-10" },
            { name: "Hammer Curl", sets: 3, reps: "10-12" },
            { name: "Preacher Curl", sets: 3, reps: "10-12" },
            { name: "Tricep Pushdown", sets: 3, reps: "10-12" },
            { name: "Overhead Tricep Extension", sets: 3, reps: "10-12" },
            { name: "Skullcrusher", sets: 3, reps: "8-10" },
        ],
    },
    {
        name: "Legs",
        dayNumber: 5,
        exercises: [
            { name: "Back Squat", sets: 4, reps: "6-8" },
            { name: "Leg Press", sets: 3, reps: "8-10" },
            { name: "Leg Extension", sets: 3, reps: "12-15" },
            { name: "Leg Curl", sets: 3, reps: "10-12" },
            { name: "Calf Raise", sets: 4, reps: "10-15" },
        ],
    },
];

const arnoldCycle: TemplateWorkout[] = [
    {
        name: "Chest + Back",
        dayNumber: 1,
        exercises: [
            { name: "Bench Press", sets: 4, reps: "6-8" },
            { name: "Incline Dumbbell Press", sets: 3, reps: "8-10" },
            { name: "Pull Ups", sets: 4, reps: "6-8" },
            { name: "Barbell Row", sets: 3, reps: "8-10" },
            { name: "Chest Fly", sets: 3, reps: "10-12" },
            { name: "Lat Pulldown", sets: 3, reps: "10-12" },
        ],
    },
    {
        name: "Shoulders + Arms",
        dayNumber: 2,
        exercises: [
            { name: "Overhead Press", sets: 4, reps: "6-8" },
            { name: "Lateral Raise", sets: 3, reps: "10-12" },
            { name: "Rear Delt Fly", sets: 3, reps: "12-15" },
            { name: "Barbell Curl", sets: 3, reps: "8-10" },
            { name: "Tricep Pushdown", sets: 3, reps: "10-12" },
            { name: "Hammer Curl", sets: 3, reps: "10-12" },
            { name: "Overhead Tricep", sets: 3, reps: "10-12" },
        ],
    },
    {
        name: "Legs",
        dayNumber: 3,
        exercises: [
            { name: "Back Squat", sets: 4, reps: "6-8" },
            { name: "Romanian Deadlift", sets: 3, reps: "8-10" },
            { name: "Leg Press", sets: 3, reps: "10-12" },
            { name: "Leg Curl", sets: 3, reps: "10-12" },
            { name: "Calf Raise", sets: 4, reps: "10-15" },
        ],
    },
];

const pplCycle: TemplateWorkout[] = [
    {
        name: "Push",
        dayNumber: 1,
        exercises: [
            { name: "Bench Press", sets: 4, reps: "6-8" },
            { name: "Incline Dumbbell Press", sets: 3, reps: "8-10" },
            { name: "Overhead Press", sets: 3, reps: "6-8" },
            { name: "Lateral Raise", sets: 3, reps: "10-12" },
            { name: "Tricep Pushdown", sets: 3, reps: "10-12" },
            { name: "Overhead Tricep", sets: 3, reps: "10-12" },
        ],
    },
    {
        name: "Pull",
        dayNumber: 2,
        exercises: [
            { name: "Pull Ups", sets: 4, reps: "6-8" },
            { name: "Barbell Row", sets: 3, reps: "8-10" },
            { name: "Lat Pulldown", sets: 3, reps: "10-12" },
            { name: "Seated Row", sets: 3, reps: "10-12" },
            { name: "Face Pull", sets: 3, reps: "12-15" },
            { name: "Barbell Curl", sets: 3, reps: "8-10" },
            { name: "Hammer Curl", sets: 3, reps: "10-12" },
        ],
    },
    {
        name: "Legs",
        dayNumber: 3,
        exercises: [
            { name: "Back Squat", sets: 4, reps: "6-8" },
            { name: "Romanian Deadlift", sets: 3, reps: "8-10" },
            { name: "Leg Press", sets: 3, reps: "10-12" },
            { name: "Leg Curl", sets: 3, reps: "10-12" },
            { name: "Calf Raise", sets: 4, reps: "10-15" },
        ],
    },
];

const cloneWorkoutForDay = (workout: TemplateWorkout, dayNumber: number): TemplateWorkout => ({
    ...workout,
    dayNumber,
    exercises: workout.exercises.map((exercise) => ({ ...exercise })),
});

export const PLAN_TEMPLATES: Record<string, Template> = {
    bro_split: {
        id: "bro_split",
        name: "Bro Split",
        description: "5-day split focusing on one main muscle group per session.",
        workouts: broSplitWorkouts,
    },
    arnold: {
        id: "arnold",
        name: "Arnold Split",
        description: "6-day bodybuilding split pairing chest/back, shoulders/arms, and legs.",
        workouts: [
            ...arnoldCycle,
            cloneWorkoutForDay(arnoldCycle[0], 4),
            cloneWorkoutForDay(arnoldCycle[1], 5),
            cloneWorkoutForDay(arnoldCycle[2], 6),
        ],
    },
    ppl: {
        id: "ppl",
        name: "Push Pull Legs",
        description: "6-day push, pull, legs split for frequent muscle-building sessions.",
        workouts: [
            ...pplCycle,
            cloneWorkoutForDay(pplCycle[0], 4),
            cloneWorkoutForDay(pplCycle[1], 5),
            cloneWorkoutForDay(pplCycle[2], 6),
        ],
    },
    upper_lower: {
        id: "upper_lower",
        name: "Upper Lower",
        description: "4-day upper/lower split with a rest day between the first lower and second upper session.",
        workouts: [
            {
                name: "Upper",
                dayNumber: 1,
                exercises: [
                    { name: "Bench Press", sets: 4, reps: "6-8" },
                    { name: "Pull Ups", sets: 4, reps: "6-8" },
                    { name: "Overhead Press", sets: 3, reps: "6-8" },
                    { name: "Barbell Row", sets: 3, reps: "8-10" },
                    { name: "Lateral Raise", sets: 3, reps: "10-12" },
                    { name: "Tricep Pushdown", sets: 3, reps: "10-12" },
                    { name: "Barbell Curl", sets: 3, reps: "8-10" },
                ],
            },
            {
                name: "Lower",
                dayNumber: 2,
                exercises: [
                    { name: "Back Squat", sets: 4, reps: "6-8" },
                    { name: "Romanian Deadlift", sets: 3, reps: "8-10" },
                    { name: "Leg Press", sets: 3, reps: "10-12" },
                    { name: "Leg Curl", sets: 3, reps: "10-12" },
                    { name: "Calf Raise", sets: 4, reps: "10-15" },
                ],
            },
            {
                name: "Rest",
                dayNumber: 3,
                exercises: [],
            },
            {
                name: "Upper",
                dayNumber: 4,
                exercises: [
                    { name: "Incline Dumbbell Press", sets: 3, reps: "8-10" },
                    { name: "Lat Pulldown", sets: 3, reps: "10-12" },
                    { name: "Seated Row", sets: 3, reps: "10-12" },
                    { name: "Lateral Raise", sets: 3, reps: "12-15" },
                    { name: "Face Pull", sets: 3, reps: "12-15" },
                    { name: "Tricep Extension", sets: 3, reps: "10-12" },
                    { name: "Hammer Curl", sets: 3, reps: "10-12" },
                ],
            },
            {
                name: "Lower",
                dayNumber: 5,
                exercises: [
                    { name: "Deadlift", sets: 3, reps: "5" },
                    { name: "Leg Press", sets: 3, reps: "10-12" },
                    { name: "Leg Extension", sets: 3, reps: "12-15" },
                    { name: "Leg Curl", sets: 3, reps: "10-12" },
                    { name: "Calf Raise", sets: 4, reps: "10-15" },
                ],
            },
        ],
    },
    full_body: {
        id: "full_body",
        name: "Full Body",
        description: "3-day full-body split for balanced progress with fewer weekly sessions.",
        workouts: [
            {
                name: "Full Body",
                dayNumber: 1,
                exercises: [
                    { name: "Squat", sets: 4, reps: "6-8" },
                    { name: "Bench Press", sets: 4, reps: "6-8" },
                    { name: "Row", sets: 3, reps: "8-10" },
                    { name: "Lateral Raise", sets: 3, reps: "10-12" },
                    { name: "Tricep Pushdown", sets: 3, reps: "10-12" },
                    { name: "Curl", sets: 3, reps: "10-12" },
                ],
            },
            {
                name: "Full Body",
                dayNumber: 2,
                exercises: [
                    { name: "Deadlift", sets: 3, reps: "5" },
                    { name: "Overhead Press", sets: 4, reps: "6-8" },
                    { name: "Pull Ups", sets: 4, reps: "6-8" },
                    { name: "Leg Curl", sets: 3, reps: "10-12" },
                    { name: "Calf Raise", sets: 4, reps: "10-15" },
                    { name: "Core", sets: 3, reps: "12-15" },
                ],
            },
            {
                name: "Full Body",
                dayNumber: 3,
                exercises: [
                    { name: "Leg Press", sets: 3, reps: "10-12" },
                    { name: "Incline Press", sets: 3, reps: "8-10" },
                    { name: "Lat Pulldown", sets: 3, reps: "10-12" },
                    { name: "Lateral Raise", sets: 3, reps: "12-15" },
                    { name: "Tricep Extension", sets: 3, reps: "10-12" },
                    { name: "Hammer Curl", sets: 3, reps: "10-12" },
                ],
            },
        ],
    },
    hybrid: {
        id: "hybrid",
        name: "Hybrid",
        description: "PPL base with an added arms and delts focus day.",
        workouts: [
            {
                name: "Push",
                dayNumber: 1,
                exercises: [
                    { name: "Bench Press", sets: 4, reps: "6-8" },
                    { name: "Incline Dumbbell Press", sets: 3, reps: "8-10" },
                    { name: "Overhead Press", sets: 3, reps: "6-8" },
                    { name: "Lateral Raise", sets: 3, reps: "10-12" },
                    { name: "Tricep Pushdown", sets: 3, reps: "10-12" },
                ],
            },
            {
                name: "Pull",
                dayNumber: 2,
                exercises: [
                    { name: "Pull Ups", sets: 4, reps: "6-8" },
                    { name: "Barbell Row", sets: 3, reps: "8-10" },
                    { name: "Lat Pulldown", sets: 3, reps: "10-12" },
                    { name: "Face Pull", sets: 3, reps: "12-15" },
                    { name: "Barbell Curl", sets: 3, reps: "8-10" },
                ],
            },
            {
                name: "Legs",
                dayNumber: 3,
                exercises: [
                    { name: "Back Squat", sets: 4, reps: "6-8" },
                    { name: "Romanian Deadlift", sets: 3, reps: "8-10" },
                    { name: "Leg Press", sets: 3, reps: "10-12" },
                    { name: "Leg Curl", sets: 3, reps: "10-12" },
                    { name: "Calf Raise", sets: 4, reps: "10-15" },
                ],
            },
            {
                name: "Arms + Delts",
                dayNumber: 4,
                exercises: [
                    { name: "Barbell Curl", sets: 3, reps: "8-10" },
                    { name: "Hammer Curl", sets: 3, reps: "10-12" },
                    { name: "Preacher Curl", sets: 3, reps: "10-12" },
                    { name: "Tricep Pushdown", sets: 3, reps: "10-12" },
                    { name: "Overhead Tricep", sets: 3, reps: "10-12" },
                    { name: "Lateral Raise", sets: 3, reps: "12-15" },
                    { name: "Rear Delt Fly", sets: 3, reps: "12-15" },
                ],
            },
            {
                name: "Rest or Repeat Cycle",
                dayNumber: 5,
                exercises: [],
            },
        ],
    },
};
