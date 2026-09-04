import type { AchievementRarity } from "./rarity";

/**
 * Maps legacy flat achievement IDs to progressive family + rarity.
 * Thresholds follow the new catalog where possible; where old targets sat
 * between new tiers (or used a different ladder), rarity is the closest
 * intended milestone from the old catalog.
 *
 * Prestige note: workouts-1000 maps to workout-warrior legendary
 * (prestige milestone 1000 is tracked separately by the engine).
 */
export const LEGACY_TO_PROGRESSIVE: Record<
    string,
    { key: string; rarity: AchievementRarity }
> = {
    // Workouts → workout-warrior
    "workouts-10": { key: "workout-warrior", rarity: "common" },
    "workouts-25": { key: "workout-warrior", rarity: "common" },
    "workouts-50": { key: "workout-warrior", rarity: "uncommon" },
    "workouts-100": { key: "workout-warrior", rarity: "rare" },
    "workouts-250": { key: "workout-warrior", rarity: "epic" },
    "workouts-500": { key: "workout-warrior", rarity: "legendary" },
    "workouts-1000": { key: "workout-warrior", rarity: "legendary" },

    // Streaks → consistency (+ flawless-100 is special)
    "streak-7": { key: "consistency", rarity: "common" },
    "streak-14": { key: "consistency", rarity: "uncommon" },
    "streak-30": { key: "consistency", rarity: "rare" },
    "streak-50": { key: "consistency", rarity: "rare" },
    "streak-100": { key: "consistency", rarity: "epic" },
    "streak-365": { key: "consistency", rarity: "legendary" },

    // Check-ins → checkin-champion
    "checkins-5": { key: "checkin-champion", rarity: "common" },
    "checkins-10": { key: "checkin-champion", rarity: "common" },
    "checkins-25": { key: "checkin-champion", rarity: "uncommon" },
    "checkins-50": { key: "checkin-champion", rarity: "epic" },
    "checkins-100": { key: "checkin-champion", rarity: "legendary" },

    // Bodyweight → weight-tracker
    "bodyweight-10": { key: "weight-tracker", rarity: "common" },
    "bodyweight-50": { key: "weight-tracker", rarity: "uncommon" },
    "bodyweight-100": { key: "weight-tracker", rarity: "rare" },

    // PRs → pr-hunter
    "prs-10": { key: "pr-hunter", rarity: "common" },
    "prs-25": { key: "pr-hunter", rarity: "uncommon" },
    "prs-50": { key: "pr-hunter", rarity: "rare" },
    "prs-100": { key: "pr-hunter", rarity: "epic" },

    // Perfect weeks → perfect-attendance
    "active-week": { key: "perfect-attendance", rarity: "common" },

    // Sets → set-collector
    "sets-100": { key: "set-collector", rarity: "common" },
    "exercises-1000": { key: "set-collector", rarity: "rare" },

    // Training time → time-under-iron
    "training-10-hours": { key: "time-under-iron", rarity: "common" },
    "training-100-hours": { key: "time-under-iron", rarity: "rare" },

    // Daily metrics → daily-discipline
    "daily-metrics-7": { key: "daily-discipline", rarity: "common" },
    "daily-metrics-30": { key: "daily-discipline", rarity: "uncommon" },

    // Plans created → planner
    "plans-5-created": { key: "planner", rarity: "uncommon" },

    // Plans copied from user → plan-creator
    "first-plan-copied-from-you": { key: "plan-creator", rarity: "common" },
    "plans-copied-from-you-5": { key: "plan-creator", rarity: "uncommon" },

    // Messages → communicator
    "messages-10": { key: "communicator", rarity: "common" },
    "messages-100": { key: "communicator", rarity: "uncommon" },

    // Tenure → tolg-veteran
    "one-month-active": { key: "tolg-veteran", rarity: "common" },
    "six-months-active": { key: "tolg-veteran", rarity: "rare" },
    "one-year-active": { key: "tolg-veteran", rarity: "epic" },
};

/**
 * Maps legacy flat achievement IDs to special achievement keys.
 * Prefer special when the old ID was a one-shot milestone rather than a tier.
 */
export const LEGACY_TO_SPECIAL: Record<string, string> = {
    "first-workout": "first-step",
    "first-workout-completed": "first-step",
    "first-check-in": "first-checkin",
    "first-pr": "first-pr",
    "first-estimated-1rm": "first-estimated-1rm",
    "onboarding-complete": "onboarding-complete",
    "created-first-plan": "first-plan",
    "first-shared-plan": "shared-plan",
    "shared-first-plan": "shared-plan",
    "first-plan-copied-from-you": "worth-copying",
    "streak-100": "flawless-100",
    "one-year-active": "one-year-strong",
};
