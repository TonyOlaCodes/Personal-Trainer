import type { AchievementRarity } from "./rarity";

export type AchievementIcon =
    | "dumbbell"
    | "trophy"
    | "flame"
    | "clipboard"
    | "scale"
    | "trending"
    | "folder"
    | "share"
    | "copy"
    | "message"
    | "users"
    | "calendar"
    | "clock"
    | "star"
    | "target"
    | "zap"
    | "compass"
    | "layers"
    | "award";

export type AchievementCategory =
    | "training"
    | "consistency"
    | "prs"
    | "checkins"
    | "tracking"
    | "plans"
    | "social"
    | "special"
    | "meta";

export type ProgressiveMetricKey =
    | "workoutsCompleted"
    | "bestStreakDays"
    | "prCount"
    | "checkIns"
    | "bodyweightDays"
    | "trainingHours"
    | "completedSets"
    | "perfectWeeks"
    | "dailyTargetDays"
    | "uniqueExercises"
    | "loggedExerciseEntries"
    | "plansCreated"
    | "plansCopiedFromUser"
    | "messagesSent"
    | "activeMonths"
    | "checkInBestStreak"
    | "prVariety"
    | "trainingDays"
    | "workoutVariety"
    | "completeAthlete"; // special - computed from other families

export interface ProgressiveTier {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
}

export interface ProgressiveDefinition {
    key: string;
    name: string;
    description: string;
    icon: AchievementIcon;
    category: AchievementCategory;
    metric: ProgressiveMetricKey;
    /** Unit label for UI e.g. "workouts", "days", "hours" */
    unit: string;
    tiers: ProgressiveTier;
    prestigeMilestones?: number[];
    /** If true, only evaluate for roles that can create plans */
    requiresPlanCreator?: boolean;
}

export interface SpecialDefinition {
    key: string;
    name: string;
    description: string;
    icon: AchievementIcon;
    category: AchievementCategory;
    rarity: AchievementRarity;
    secret?: boolean;
}

export type AchievementEventType = "unlock" | "upgrade" | "milestone";

export interface AchievementEventPayload {
    id: string;
    familyKey: string;
    name: string;
    rarity: AchievementRarity;
    eventType: AchievementEventType;
    description: string;
    icon: AchievementIcon;
    metricLabel?: string;
}
