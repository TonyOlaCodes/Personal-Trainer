import type { AchievementRarity } from "./rarity";
import { ACHIEVEMENT_RARITIES } from "./rarity";
import type { ProgressiveDefinition } from "./types";

export const PROGRESSIVE_ACHIEVEMENTS: ProgressiveDefinition[] = [
    {
        key: "workout-warrior",
        name: "Workout Warrior",
        description: "Complete training sessions and keep stacking volume over time.",
        icon: "dumbbell",
        category: "training",
        metric: "workoutsCompleted",
        unit: "workouts",
        tiers: { common: 10, uncommon: 50, rare: 100, epic: 200, legendary: 400 },
        prestigeMilestones: [500, 750, 1000],
    },
    {
        key: "consistency",
        name: "Consistency",
        description: "Build your longest adherence streak across scheduled training and rest days.",
        icon: "flame",
        category: "consistency",
        metric: "bestStreakDays",
        unit: "days",
        tiers: { common: 7, uncommon: 14, rare: 30, epic: 75, legendary: 180 },
    },
    {
        key: "pr-hunter",
        name: "PR Hunter",
        description: "Collect personal records across your lifts.",
        icon: "zap",
        category: "prs",
        metric: "prCount",
        unit: "PRs",
        tiers: { common: 5, uncommon: 20, rare: 50, epic: 100, legendary: 200 },
    },
    {
        key: "checkin-champion",
        name: "Check-in Champion",
        description: "Stay accountable with weekly check-ins.",
        icon: "clipboard",
        category: "checkins",
        metric: "checkIns",
        unit: "check-ins",
        tiers: { common: 5, uncommon: 15, rare: 30, epic: 60, legendary: 100 },
    },
    {
        key: "weight-tracker",
        name: "Weight Tracker",
        description: "Log bodyweight on distinct days to track trends.",
        icon: "scale",
        category: "tracking",
        metric: "bodyweightDays",
        unit: "days",
        tiers: { common: 10, uncommon: 30, rare: 100, epic: 200, legendary: 365 },
    },
    {
        key: "time-under-iron",
        name: "Time Under Iron",
        description: "Accumulate hours spent in completed workouts.",
        icon: "clock",
        category: "training",
        metric: "trainingHours",
        unit: "hours",
        tiers: { common: 10, uncommon: 50, rare: 100, epic: 250, legendary: 400 },
    },
    {
        key: "set-collector",
        name: "Set Collector",
        description: "Complete working sets across all your sessions.",
        icon: "layers",
        category: "training",
        metric: "completedSets",
        unit: "sets",
        tiers: { common: 100, uncommon: 500, rare: 1500, epic: 4000, legendary: 7500 },
    },
    {
        key: "perfect-attendance",
        name: "Perfect Attendance",
        description: "Finish every scheduled workout in a calendar week.",
        icon: "calendar",
        category: "consistency",
        metric: "perfectWeeks",
        unit: "weeks",
        tiers: { common: 1, uncommon: 4, rare: 12, epic: 25, legendary: 40 },
    },
    {
        key: "daily-discipline",
        name: "Daily Discipline",
        description: "Log daily targets like calories, steps, or sleep on separate days.",
        icon: "target",
        category: "tracking",
        metric: "dailyTargetDays",
        unit: "days",
        tiers: { common: 7, uncommon: 30, rare: 100, epic: 200, legendary: 365 },
    },
    {
        key: "exercise-explorer",
        name: "Exercise Explorer",
        description: "Train a growing library of unique exercises.",
        icon: "compass",
        category: "training",
        metric: "uniqueExercises",
        unit: "exercises",
        tiers: { common: 10, uncommon: 25, rare: 50, epic: 100, legendary: 150 },
    },
    {
        key: "logged-exercises",
        name: "Logged Exercises",
        description: "Accumulate logged exercise entries across workouts.",
        icon: "dumbbell",
        category: "training",
        metric: "loggedExerciseEntries",
        unit: "entries",
        tiers: { common: 50, uncommon: 250, rare: 1000, epic: 2500, legendary: 5000 },
    },
    {
        key: "planner",
        name: "Planner",
        description: "Create workout plans for yourself or athletes.",
        icon: "folder",
        category: "plans",
        metric: "plansCreated",
        unit: "plans",
        tiers: { common: 1, uncommon: 5, rare: 15, epic: 30, legendary: 50 },
        requiresPlanCreator: true,
    },
    {
        key: "plan-creator",
        name: "Plan Creator",
        description: "Have other athletes copy plans you shared.",
        icon: "copy",
        category: "plans",
        metric: "plansCopiedFromUser",
        unit: "copies",
        tiers: { common: 1, uncommon: 5, rare: 20, epic: 50, legendary: 100 },
        requiresPlanCreator: true,
    },
    {
        key: "communicator",
        name: "Communicator",
        description: "Stay in touch by sending direct messages.",
        icon: "message",
        category: "social",
        metric: "messagesSent",
        unit: "messages",
        tiers: { common: 10, uncommon: 100, rare: 500, epic: 2000, legendary: 5000 },
    },
    {
        key: "tolg-veteran",
        name: "TOLG Veteran",
        description: "Stay active on TOLG across calendar months with training logged.",
        icon: "award",
        category: "meta",
        metric: "activeMonths",
        unit: "months",
        tiers: { common: 1, uncommon: 3, rare: 6, epic: 12, legendary: 24 },
    },
    {
        key: "checkin-consistency",
        name: "Check-in Consistency",
        description: "Build your longest streak of consecutive weekly check-ins.",
        icon: "clipboard",
        category: "checkins",
        metric: "checkInBestStreak",
        unit: "weeks",
        tiers: { common: 3, uncommon: 6, rare: 12, epic: 25, legendary: 50 },
    },
    {
        key: "pr-variety",
        name: "PR Variety",
        description: "Hit PRs across a wider set of distinct exercises.",
        icon: "trending",
        category: "prs",
        metric: "prVariety",
        unit: "exercises",
        tiers: { common: 3, uncommon: 10, rare: 20, epic: 40, legendary: 75 },
    },
    {
        key: "training-days",
        name: "Training Days",
        description: "Train on more distinct calendar days.",
        icon: "calendar",
        category: "training",
        metric: "trainingDays",
        unit: "days",
        tiers: { common: 10, uncommon: 50, rare: 150, epic: 300, legendary: 500 },
    },
    {
        key: "workout-variety",
        name: "Workout Variety",
        description: "Complete a broader mix of distinct workout templates.",
        icon: "layers",
        category: "training",
        metric: "workoutVariety",
        unit: "workouts",
        tiers: { common: 3, uncommon: 10, rare: 20, epic: 40, legendary: 75 },
    },
    {
        key: "complete-athlete",
        name: "Complete Athlete",
        description:
            "Earn progressive achievements across families. Tiers require that many other families at the matching rarity (common 3, uncommon 5, rare 8, epic 10, legendary 12). Legendary also requires at least 3 families at legendary — enforced by the evaluation engine.",
        icon: "trophy",
        category: "meta",
        metric: "completeAthlete",
        unit: "families",
        // Counts of other families at that rarity (not a raw metric value).
        tiers: { common: 3, uncommon: 5, rare: 8, epic: 10, legendary: 12 },
    },
];

export const PROGRESSIVE_KEYS = PROGRESSIVE_ACHIEVEMENTS.map((d) => d.key);

const byKey = new Map(PROGRESSIVE_ACHIEVEMENTS.map((d) => [d.key, d]));

export function getProgressiveByKey(key: string): ProgressiveDefinition | undefined {
    return byKey.get(key);
}

export function tierRequirement(
    def: ProgressiveDefinition,
    rarity: AchievementRarity
): number {
    return def.tiers[rarity];
}

/** Highest tier met by value. Not valid for complete-athlete (engine-computed). */
export function rarityForValue(
    def: ProgressiveDefinition,
    value: number
): AchievementRarity | null {
    if (def.metric === "completeAthlete") return null;
    let best: AchievementRarity | null = null;
    for (const rarity of ACHIEVEMENT_RARITIES) {
        if (value >= def.tiers[rarity]) {
            best = rarity;
        }
    }
    return best;
}
