export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

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
    | "zap";

export interface AchievementDefinition {
    id: string;
    title: string;
    description: string;
    rarity: AchievementRarity;
    icon: AchievementIcon;
    /** Counter target; omit for boolean milestones */
    target?: number;
    progressKey?: keyof AchievementStats;
}

/** Stats snapshot used to evaluate every achievement in one pass. */
export interface AchievementStats {
    workoutLogsTotal: number;
    workoutsCompleted: number;
    checkIns: number;
    prCount: number;
    bodyweightLogs: number;
    maxAdherenceStreak: number;
    perfectWeeks: number;
    scheduledHits: number;
    publicPlans: number;
    plansCreated: number;
    plansCopied: number;
    messagesSent: number;
    profileVisitsMade: number;
    plansCopiedFromUser: number;
    accountAgeDays: number;
    completedSets: number;
    totalTrainingMinutes: number;
    hasEstimated1RM: boolean;
    onboardingDone: boolean;
    dailyMetricsLogs: number;
}

/** Fixed catalog — append new achievements at the end only. */
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
    // Getting started
    { id: "first-workout", title: "First Workout", description: "Start your first training session", rarity: "common", icon: "dumbbell" },
    { id: "first-workout-completed", title: "First Workout Completed", description: "Complete your first workout", rarity: "common", icon: "trophy", target: 1, progressKey: "workoutsCompleted" },
    { id: "first-check-in", title: "First Check-in", description: "Submit your first weekly check-in", rarity: "common", icon: "clipboard", target: 1, progressKey: "checkIns" },
    { id: "first-pr", title: "First PR", description: "Set your first personal record", rarity: "common", icon: "zap", target: 1, progressKey: "prCount" },
    { id: "first-bodyweight-log", title: "First Bodyweight Log", description: "Log your bodyweight for the first time", rarity: "common", icon: "scale", target: 1, progressKey: "bodyweightLogs" },
    { id: "first-workout-streak", title: "Didn't Miss a Workout", description: "Complete a scheduled workout on its planned day", rarity: "common", icon: "flame", target: 1, progressKey: "scheduledHits" },
    { id: "first-shared-plan", title: "First Shared Plan", description: "Make a workout plan public", rarity: "common", icon: "share", target: 1, progressKey: "publicPlans" },

    // Workouts
    { id: "workouts-10", title: "10 Workouts Completed", description: "Complete 10 training sessions", rarity: "common", icon: "dumbbell", target: 10, progressKey: "workoutsCompleted" },
    { id: "workouts-25", title: "25 Workouts Completed", description: "Complete 25 training sessions", rarity: "common", icon: "dumbbell", target: 25, progressKey: "workoutsCompleted" },
    { id: "workouts-50", title: "50 Workouts Completed", description: "Complete 50 training sessions", rarity: "rare", icon: "dumbbell", target: 50, progressKey: "workoutsCompleted" },
    { id: "workouts-100", title: "100 Workouts Completed", description: "Complete 100 training sessions", rarity: "rare", icon: "dumbbell", target: 100, progressKey: "workoutsCompleted" },
    { id: "workouts-250", title: "250 Workouts Completed", description: "Complete 250 training sessions", rarity: "epic", icon: "dumbbell", target: 250, progressKey: "workoutsCompleted" },
    { id: "workouts-500", title: "500 Workouts Completed", description: "Complete 500 training sessions", rarity: "legendary", icon: "dumbbell", target: 500, progressKey: "workoutsCompleted" },

    { id: "streak-3", title: "3 Workout Adherence Streak", description: "Complete 3 scheduled workouts in a row without missing one", rarity: "common", icon: "flame", target: 3, progressKey: "maxAdherenceStreak" },
    { id: "streak-7", title: "7 Workout Adherence Streak", description: "Complete 7 scheduled workouts in a row without missing one", rarity: "common", icon: "flame", target: 7, progressKey: "maxAdherenceStreak" },
    { id: "streak-14", title: "14 Workout Adherence Streak", description: "Complete 14 scheduled workouts in a row without missing one", rarity: "rare", icon: "flame", target: 14, progressKey: "maxAdherenceStreak" },
    { id: "streak-30", title: "30 Workout Adherence Streak", description: "Complete 30 scheduled workouts in a row without missing one", rarity: "rare", icon: "flame", target: 30, progressKey: "maxAdherenceStreak" },
    { id: "streak-50", title: "50 Workout Adherence Streak", description: "Complete 50 scheduled workouts in a row without missing one", rarity: "epic", icon: "flame", target: 50, progressKey: "maxAdherenceStreak" },
    { id: "streak-100", title: "100 Workout Adherence Streak", description: "Complete 100 scheduled workouts in a row without missing one", rarity: "epic", icon: "flame", target: 100, progressKey: "maxAdherenceStreak" },
    { id: "streak-365", title: "365 Workout Adherence Streak", description: "Complete 365 scheduled workouts in a row without missing one", rarity: "legendary", icon: "flame", target: 365, progressKey: "maxAdherenceStreak" },

    // Check-ins
    { id: "checkins-5", title: "5 Check-ins", description: "Submit 5 weekly check-ins", rarity: "common", icon: "clipboard", target: 5, progressKey: "checkIns" },
    { id: "checkins-10", title: "10 Check-ins", description: "Submit 10 weekly check-ins", rarity: "common", icon: "clipboard", target: 10, progressKey: "checkIns" },
    { id: "checkins-25", title: "25 Check-ins", description: "Submit 25 weekly check-ins", rarity: "rare", icon: "clipboard", target: 25, progressKey: "checkIns" },
    { id: "checkins-50", title: "50 Check-ins", description: "Submit 50 weekly check-ins", rarity: "epic", icon: "clipboard", target: 50, progressKey: "checkIns" },
    { id: "checkins-100", title: "100 Check-ins", description: "Submit 100 weekly check-ins", rarity: "legendary", icon: "clipboard", target: 100, progressKey: "checkIns" },

    // Bodyweight
    { id: "bodyweight-10", title: "10 Bodyweight Logs", description: "Log bodyweight 10 times", rarity: "common", icon: "scale", target: 10, progressKey: "bodyweightLogs" },
    { id: "bodyweight-50", title: "50 Bodyweight Logs", description: "Log bodyweight 50 times", rarity: "rare", icon: "scale", target: 50, progressKey: "bodyweightLogs" },
    { id: "bodyweight-100", title: "100 Bodyweight Logs", description: "Log bodyweight 100 times", rarity: "epic", icon: "scale", target: 100, progressKey: "bodyweightLogs" },

    // Progress
    { id: "first-estimated-1rm", title: "First Estimated 1RM", description: "Log a weighted strength set", rarity: "common", icon: "trending" },
    { id: "prs-10", title: "10 Personal Records", description: "Hit 10 personal records", rarity: "common", icon: "zap", target: 10, progressKey: "prCount" },
    { id: "prs-25", title: "25 Personal Records", description: "Hit 25 personal records", rarity: "rare", icon: "zap", target: 25, progressKey: "prCount" },
    { id: "prs-50", title: "50 Personal Records", description: "Hit 50 personal records", rarity: "epic", icon: "zap", target: 50, progressKey: "prCount" },
    { id: "active-week", title: "Perfect Training Week", description: "Complete every scheduled workout in a calendar week", rarity: "rare", icon: "calendar", target: 1, progressKey: "perfectWeeks" },

    // Plans
    { id: "created-first-plan", title: "Created First Plan", description: "Build your first workout plan", rarity: "common", icon: "folder", target: 1, progressKey: "plansCreated" },
    { id: "shared-first-plan", title: "Shared First Plan", description: "Share a plan on your public profile", rarity: "common", icon: "share", target: 1, progressKey: "publicPlans" },
    { id: "copied-first-plan", title: "Copied First Plan", description: "Copy a plan from another athlete", rarity: "common", icon: "copy", target: 1, progressKey: "plansCopied" },

    // Community
    { id: "first-message-sent", title: "First Message Sent", description: "Send your first direct message", rarity: "common", icon: "message", target: 1, progressKey: "messagesSent" },
    { id: "messages-100", title: "100 Messages Sent", description: "Send 100 direct messages", rarity: "epic", icon: "message", target: 100, progressKey: "messagesSent" },
    { id: "first-profile-visit", title: "First Public Profile Visit", description: "Visit another athlete's profile", rarity: "common", icon: "users", target: 1, progressKey: "profileVisitsMade" },
    { id: "first-plan-copied-from-you", title: "First Plan Copied From You", description: "Someone copied one of your public plans", rarity: "rare", icon: "copy", target: 1, progressKey: "plansCopiedFromUser" },

    // Milestones
    { id: "one-month-active", title: "One Month Active", description: "Member for 30 days with training logged", rarity: "common", icon: "calendar" },
    { id: "six-months-active", title: "Six Months Active", description: "Member for 6 months with training logged", rarity: "rare", icon: "calendar" },
    { id: "one-year-active", title: "One Year Active", description: "Member for one year with training logged", rarity: "epic", icon: "calendar" },
    { id: "exercises-1000", title: "Logged 1,000 Exercises", description: "Complete 1,000 working sets", rarity: "epic", icon: "target", target: 1000, progressKey: "completedSets" },
    { id: "training-100-hours", title: "Completed 100 Hours of Training", description: "Log 100 hours of workout time", rarity: "legendary", icon: "clock", target: 6000, progressKey: "totalTrainingMinutes" },

    // Long-term extras (append-only)
    { id: "onboarding-complete", title: "Onboarding Complete", description: "Finish your athlete setup", rarity: "common", icon: "star" },
    { id: "workouts-1000", title: "1,000 Workouts Completed", description: "Complete 1,000 training sessions", rarity: "legendary", icon: "dumbbell", target: 1000, progressKey: "workoutsCompleted" },
    { id: "prs-100", title: "100 Personal Records", description: "Hit 100 personal records", rarity: "legendary", icon: "zap", target: 100, progressKey: "prCount" },
    { id: "plans-5-created", title: "Created 5 Plans", description: "Build 5 workout plans", rarity: "rare", icon: "folder", target: 5, progressKey: "plansCreated" },
    { id: "messages-10", title: "10 Messages Sent", description: "Send 10 direct messages", rarity: "common", icon: "message", target: 10, progressKey: "messagesSent" },
];

export const TOTAL_ACHIEVEMENTS = ACHIEVEMENT_DEFINITIONS.length;
export const TOTAL_CLIENT_ACHIEVEMENTS = TOTAL_ACHIEVEMENTS;

export function evaluateAchievement(def: AchievementDefinition, stats: AchievementStats): boolean {
    if (def.id === "first-workout") return stats.workoutLogsTotal >= 1;
    if (def.id === "first-estimated-1rm") return stats.hasEstimated1RM;
    if (def.id === "onboarding-complete") return stats.onboardingDone;
    if (def.id === "one-month-active") return stats.accountAgeDays >= 30 && stats.workoutsCompleted >= 1;
    if (def.id === "six-months-active") return stats.accountAgeDays >= 183 && stats.workoutsCompleted >= 1;
    if (def.id === "one-year-active") return stats.accountAgeDays >= 365 && stats.workoutsCompleted >= 1;

    if (def.target != null && def.progressKey) {
        const value = stats[def.progressKey];
        return typeof value === "number" && value >= def.target;
    }

    return false;
}

export function getAchievementProgress(
    def: AchievementDefinition,
    stats: AchievementStats
): { current: number; target: number } | null {
    if (def.id === "first-workout") {
        return { current: Math.min(stats.workoutLogsTotal, 1), target: 1 };
    }
    if (def.id === "first-estimated-1rm") {
        return { current: stats.hasEstimated1RM ? 1 : 0, target: 1 };
    }
    if (def.id === "onboarding-complete") {
        return { current: stats.onboardingDone ? 1 : 0, target: 1 };
    }
    if (def.id === "one-month-active") {
        return { current: Math.min(stats.accountAgeDays, 30), target: 30 };
    }
    if (def.id === "six-months-active") {
        return { current: Math.min(stats.accountAgeDays, 183), target: 183 };
    }
    if (def.id === "one-year-active") {
        return { current: Math.min(stats.accountAgeDays, 365), target: 365 };
    }

    if (def.target != null && def.progressKey) {
        const value = stats[def.progressKey];
        const current = typeof value === "number" ? value : 0;
        return { current: Math.min(current, def.target), target: def.target };
    }

    return null;
}

export const RARITY_STYLES: Record<
    AchievementRarity,
    { ring: string; icon: string; label: string; badge: string }
> = {
    common: {
        ring: "border-surface-border",
        icon: "text-fg-muted",
        label: "text-fg-subtle",
        badge: "bg-surface-muted text-fg-muted border-surface-border",
    },
    rare: {
        ring: "border-brand-400/40",
        icon: "text-brand-400",
        label: "text-brand-400",
        badge: "bg-brand-400/10 text-brand-300 border-brand-400/25",
    },
    epic: {
        ring: "border-violet-400/40",
        icon: "text-violet-400",
        label: "text-violet-400",
        badge: "bg-violet-400/10 text-violet-300 border-violet-400/25",
    },
    legendary: {
        ring: "border-amber-400/50",
        icon: "text-amber-400",
        label: "text-amber-400",
        badge: "bg-amber-400/10 text-amber-300 border-amber-400/25",
    },
};
