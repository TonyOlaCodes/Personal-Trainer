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

export const PLAN_TEMPLATES: Record<string, Template> = {
    ppl: {
        id: "ppl",
        name: "Push Pull Legs (PPL)",
        description: "A classic 3-6 day split designed for balanced hypertrophy and strength.",
        workouts: [
            {
                name: "Push (Chest, Shoulders, Triceps)",
                dayNumber: 1,
                exercises: [
                    { name: "Barbell Bench Press", sets: 3, reps: "8-12" },
                    { name: "Overhead Press", sets: 3, reps: "8-12" },
                    { name: "Incline Dumbbell Press", sets: 3, reps: "10-12" },
                    { name: "Dumbbell Lateral Raises", sets: 3, reps: "15" },
                    { name: "Tricep Pushdowns", sets: 3, reps: "12-15" }
                ]
            },
            {
                name: "Pull (Back, Biceps, Rear Delts)",
                dayNumber: 2,
                exercises: [
                    { name: "Barbell Rows", sets: 3, reps: "8-12" },
                    { name: "Lat Pulldowns", sets: 3, reps: "10-12" },
                    { name: "Seated Cable Rows", sets: 3, reps: "12" },
                    { name: "Face Pulls", sets: 3, reps: "15-20" },
                    { name: "Barbell Bicep Curls", sets: 3, reps: "10-12" }
                ]
            },
            {
                name: "Legs (Quads, Hamstrings, Calves)",
                dayNumber: 3,
                exercises: [
                    { name: "Barbell Squats", sets: 3, reps: "6-10" },
                    { name: "Leg Press", sets: 3, reps: "12-15" },
                    { name: "Leg Curls", sets: 3, reps: "12-15" },
                    { name: "Leg Extensions", sets: 3, reps: "12-15" },
                    { name: "Seated Calf Raises", sets: 4, reps: "15" }
                ]
            }
        ]
    },
    arnold: {
        id: "arnold",
        name: "Arnold Split",
        description: "High-volume split focusing on Chest/Back, Shoulders/Arms, and Legs.",
        workouts: [
            {
                name: "Chest & Back",
                dayNumber: 1,
                exercises: [
                    { name: "Incline Bench Press", sets: 4, reps: "10" },
                    { name: "Flat Dumbbell Flyes", sets: 3, reps: "12" },
                    { name: "Wide Grip Pull-Ups", sets: 4, reps: "Failure" },
                    { name: "Bent Over Rows", sets: 4, reps: "10" },
                    { name: "Dumbbell Pullovers", sets: 3, reps: "12" }
                ]
            },
            {
                name: "Shoulders & Arms",
                dayNumber: 2,
                exercises: [
                    { name: "Military Press", sets: 4, reps: "10" },
                    { name: "Dumbbell Lateral Raises", sets: 4, reps: "12" },
                    { name: "Barbell Curls", sets: 4, reps: "10" },
                    { name: "Skull Crushers", sets: 4, reps: "10" },
                    { name: "Seated Dumbbell Curls", sets: 3, reps: "12" }
                ]
            },
            {
                name: "Legs",
                dayNumber: 3,
                exercises: [
                    { name: "Squats", sets: 4, reps: "10" },
                    { name: "Straight Leg Deadlifts", sets: 4, reps: "12" },
                    { name: "Leg Extensions", sets: 3, reps: "15" },
                    { name: "Calf Raises", sets: 5, reps: "15" }
                ]
            }
        ]
    },
    pplul: {
        id: "pplul",
        name: "PPL / Upper Lower",
        description: "5-day hybrid split for maximum frequency and recovery balancing.",
        workouts: [
            {
                name: "Upper Power",
                dayNumber: 1,
                exercises: [
                    { name: "Bench Press", sets: 3, reps: "5-8" },
                    { name: "Weighted Pull-Ups", sets: 3, reps: "5-8" },
                    { name: "Overhead Press", sets: 3, reps: "8-10" },
                    { name: "Barbell Rows", sets: 3, reps: "8-10" }
                ]
            },
            {
                name: "Lower Power",
                dayNumber: 2,
                exercises: [
                    { name: "Squats", sets: 3, reps: "5-8" },
                    { name: "Deadlifts", sets: 3, reps: "5" },
                    { name: "Leg Press", sets: 3, reps: "10-12" },
                    { name: "Seated Calf Raises", sets: 4, reps: "12" }
                ]
            },
            {
                name: "Push Hypertrophy",
                dayNumber: 3,
                exercises: [
                    { name: "Incline DB Press", sets: 3, reps: "10-12" },
                    { name: "Cable Flyes", sets: 3, reps: "15" },
                    { name: "Lateral Raises", sets: 4, reps: "15" },
                    { name: "Tricep Extensions", sets: 3, reps: "12" }
                ]
            },
            {
                name: "Pull Hypertrophy",
                dayNumber: 4,
                exercises: [
                    { name: "Seated Cable Rows", sets: 3, reps: "12" },
                    { name: "Lat Pulldowns", sets: 3, reps: "12" },
                    { name: "Face Pulls", sets: 3, reps: "20" },
                    { name: "Hammer Curls", sets: 3, reps: "12" }
                ]
            },
            {
                name: "Legs Hypertrophy",
                dayNumber: 5,
                exercises: [
                    { name: "Leg Extensions", sets: 3, reps: "15" },
                    { name: "Leg Curls", sets: 3, reps: "15" },
                    { name: "Romanian Deadlifts", sets: 3, reps: "12" },
                    { name: "Calf Raises", sets: 4, reps: "20" }
                ]
            }
        ]
    },
    bro: {
        id: "bro",
        name: "Classic Bro Split",
        description: "5-day split hitting one muscle group per day for ultimate pump.",
        workouts: [
            { name: "Chest Day", dayNumber: 1, exercises: [{ name: "Bench Press", sets: 4, reps: "10" }, { name: "Incline Press", sets: 3, reps: "10" }, { name: "Decline Press", sets: 3, reps: "10" }, { name: "Cable Crossovers", sets: 4, reps: "15" }] },
            { name: "Back Day", dayNumber: 2, exercises: [{ name: "Deadlifts", sets: 3, reps: "8" }, { name: "Bent Rows", sets: 4, reps: "10" }, { name: "Lat Pulldowns", sets: 3, reps: "12" }, { name: "One-Arm Rows", sets: 3, reps: "10" }] },
            { name: "Shoulder Day", dayNumber: 3, exercises: [{ name: "Military Press", sets: 4, reps: "10" }, { name: "Lateral Raises", sets: 4, reps: "15" }, { name: "Front Raises", sets: 3, reps: "12" }, { name: "Rear Delt Flyes", sets: 3, reps: "15" }] },
            { name: "Leg Day", dayNumber: 4, exercises: [{ name: "Squats", sets: 4, reps: "10" }, { name: "Leg Press", sets: 3, reps: "12" }, { name: "Leg Extensions", sets: 3, reps: "15" }, { name: "Hamstring Curls", sets: 3, reps: "15" }] },
            { name: "Arm Day", dayNumber: 5, exercises: [{ name: "Barbell Curls", sets: 4, reps: "10" }, { name: "Skull Crushers", sets: 4, reps: "10" }, { name: "Hammer Curls", sets: 3, reps: "12" }, { name: "Pushdowns", sets: 3, reps: "12" }] }
        ]
    }
};
