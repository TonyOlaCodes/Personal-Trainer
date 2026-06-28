import type { AchievementIcon, AchievementRarity } from "@/lib/achievementDefinitions";

export interface CoachAchievementStats {
    activeClients: number;
    checkInsReviewed: number;
    plansCreated: number;
    plansAssigned: number;
    workoutNotes: number;
    accessCodesGenerated: number;
    accessCodesRedeemed: number;
    clientMessages: number;
    attentionActions: number;
    videoCheckInReviews: number;
    coachAccountAgeDays: number;
}

export type CoachAchievementDefinition = {
    id: string;
    title: string;
    description: string;
    rarity: AchievementRarity;
    icon: AchievementIcon;
    target?: number;
    progressKey?: keyof CoachAchievementStats;
};

/** Coach-only catalog — 50 milestones for coaching actions. Append at end only. */
export const COACH_ACHIEVEMENT_DEFINITIONS: CoachAchievementDefinition[] = [
    // Getting started
    { id: "coach-first-client", title: "First Client", description: "Add your first athlete to your roster", rarity: "common", icon: "users", target: 1, progressKey: "activeClients" },
    { id: "coach-first-review", title: "First Check-in Review", description: "Review your first client check-in", rarity: "common", icon: "clipboard", target: 1, progressKey: "checkInsReviewed" },
    { id: "coach-first-plan-assigned", title: "First Plan Assigned", description: "Assign a training plan to a client", rarity: "common", icon: "folder", target: 1, progressKey: "plansAssigned" },
    { id: "coach-first-workout-note", title: "First Workout Feedback", description: "Leave feedback on a client's workout log", rarity: "common", icon: "message", target: 1, progressKey: "workoutNotes" },
    { id: "coach-first-invite", title: "First Invite Code", description: "Generate your first client invite code", rarity: "common", icon: "share", target: 1, progressKey: "accessCodesGenerated" },
    { id: "coach-first-message", title: "First Client Message", description: "Send your first direct message to a client", rarity: "common", icon: "message", target: 1, progressKey: "clientMessages" },

    // Roster size
    { id: "coach-clients-5", title: "5 Active Clients", description: "Coach 5 athletes on your roster", rarity: "common", icon: "users", target: 5, progressKey: "activeClients" },
    { id: "coach-clients-10", title: "10 Active Clients", description: "Coach 10 athletes on your roster", rarity: "rare", icon: "users", target: 10, progressKey: "activeClients" },
    { id: "coach-clients-20", title: "20 Active Clients", description: "Coach 20 athletes on your roster", rarity: "rare", icon: "users", target: 20, progressKey: "activeClients" },
    { id: "coach-clients-35", title: "35 Active Clients", description: "Coach 35 athletes on your roster", rarity: "epic", icon: "users", target: 35, progressKey: "activeClients" },
    { id: "coach-clients-50", title: "50 Active Clients", description: "Coach 50 athletes on your roster", rarity: "legendary", icon: "users", target: 50, progressKey: "activeClients" },

    // Check-in reviews
    { id: "coach-reviews-5", title: "5 Check-ins Reviewed", description: "Review 5 client check-ins", rarity: "common", icon: "clipboard", target: 5, progressKey: "checkInsReviewed" },
    { id: "coach-reviews-10", title: "10 Check-ins Reviewed", description: "Review 10 client check-ins", rarity: "common", icon: "clipboard", target: 10, progressKey: "checkInsReviewed" },
    { id: "coach-reviews-25", title: "25 Check-ins Reviewed", description: "Review 25 client check-ins", rarity: "rare", icon: "clipboard", target: 25, progressKey: "checkInsReviewed" },
    { id: "coach-reviews-50", title: "50 Check-ins Reviewed", description: "Review 50 client check-ins", rarity: "rare", icon: "clipboard", target: 50, progressKey: "checkInsReviewed" },
    { id: "coach-reviews-100", title: "100 Check-ins Reviewed", description: "Review 100 client check-ins", rarity: "epic", icon: "clipboard", target: 100, progressKey: "checkInsReviewed" },
    { id: "coach-reviews-250", title: "250 Check-ins Reviewed", description: "Review 250 client check-ins", rarity: "epic", icon: "clipboard", target: 250, progressKey: "checkInsReviewed" },
    { id: "coach-reviews-500", title: "500 Check-ins Reviewed", description: "Review 500 client check-ins", rarity: "legendary", icon: "clipboard", target: 500, progressKey: "checkInsReviewed" },

    // Plans built
    { id: "coach-plans-5", title: "5 Plans Built", description: "Create 5 training plans for clients", rarity: "common", icon: "folder", target: 5, progressKey: "plansCreated" },
    { id: "coach-plans-15", title: "15 Plans Built", description: "Create 15 training plans for clients", rarity: "rare", icon: "folder", target: 15, progressKey: "plansCreated" },
    { id: "coach-plans-30", title: "30 Plans Built", description: "Create 30 training plans for clients", rarity: "epic", icon: "folder", target: 30, progressKey: "plansCreated" },
    { id: "coach-plans-50", title: "50 Plans Built", description: "Create 50 training plans for clients", rarity: "legendary", icon: "folder", target: 50, progressKey: "plansCreated" },

    // Plans assigned
    { id: "coach-assign-10", title: "10 Plans Assigned", description: "Assign training plans to clients 10 times", rarity: "common", icon: "share", target: 10, progressKey: "plansAssigned" },
    { id: "coach-assign-25", title: "25 Plans Assigned", description: "Assign training plans to clients 25 times", rarity: "rare", icon: "share", target: 25, progressKey: "plansAssigned" },
    { id: "coach-assign-50", title: "50 Plans Assigned", description: "Assign training plans to clients 50 times", rarity: "epic", icon: "share", target: 50, progressKey: "plansAssigned" },
    { id: "coach-assign-100", title: "100 Plans Assigned", description: "Assign training plans to clients 100 times", rarity: "legendary", icon: "share", target: 100, progressKey: "plansAssigned" },

    // Workout feedback
    { id: "coach-notes-5", title: "5 Workout Notes", description: "Leave feedback on 5 client workouts", rarity: "common", icon: "message", target: 5, progressKey: "workoutNotes" },
    { id: "coach-notes-10", title: "10 Workout Notes", description: "Leave feedback on 10 client workouts", rarity: "common", icon: "message", target: 10, progressKey: "workoutNotes" },
    { id: "coach-notes-25", title: "25 Workout Notes", description: "Leave feedback on 25 client workouts", rarity: "rare", icon: "message", target: 25, progressKey: "workoutNotes" },
    { id: "coach-notes-50", title: "50 Workout Notes", description: "Leave feedback on 50 client workouts", rarity: "epic", icon: "message", target: 50, progressKey: "workoutNotes" },
    { id: "coach-notes-100", title: "100 Workout Notes", description: "Leave feedback on 100 client workouts", rarity: "legendary", icon: "message", target: 100, progressKey: "workoutNotes" },

    // Invite codes
    { id: "coach-codes-5", title: "5 Invite Codes", description: "Generate 5 client invite codes", rarity: "common", icon: "share", target: 5, progressKey: "accessCodesGenerated" },
    { id: "coach-codes-25", title: "25 Invite Codes", description: "Generate 25 client invite codes", rarity: "rare", icon: "share", target: 25, progressKey: "accessCodesGenerated" },
    { id: "coach-codes-50", title: "50 Invite Codes", description: "Generate 50 client invite codes", rarity: "epic", icon: "share", target: 50, progressKey: "accessCodesGenerated" },
    { id: "coach-redeemed-5", title: "5 Codes Redeemed", description: "Have 5 invite codes redeemed by athletes", rarity: "common", icon: "star", target: 5, progressKey: "accessCodesRedeemed" },
    { id: "coach-redeemed-25", title: "25 Codes Redeemed", description: "Have 25 invite codes redeemed by athletes", rarity: "rare", icon: "star", target: 25, progressKey: "accessCodesRedeemed" },
    { id: "coach-redeemed-50", title: "50 Codes Redeemed", description: "Have 50 invite codes redeemed by athletes", rarity: "legendary", icon: "star", target: 50, progressKey: "accessCodesRedeemed" },

    // Client messaging
    { id: "coach-messages-10", title: "10 Client Messages", description: "Send 10 direct messages to clients", rarity: "common", icon: "message", target: 10, progressKey: "clientMessages" },
    { id: "coach-messages-50", title: "50 Client Messages", description: "Send 50 direct messages to clients", rarity: "rare", icon: "message", target: 50, progressKey: "clientMessages" },
    { id: "coach-messages-100", title: "100 Client Messages", description: "Send 100 direct messages to clients", rarity: "epic", icon: "message", target: 100, progressKey: "clientMessages" },
    { id: "coach-messages-500", title: "500 Client Messages", description: "Send 500 direct messages to clients", rarity: "legendary", icon: "message", target: 500, progressKey: "clientMessages" },

    // Needs attention inbox
    { id: "coach-attention-1", title: "First Alert Handled", description: "Dismiss or excuse your first needs-attention alert", rarity: "common", icon: "target", target: 1, progressKey: "attentionActions" },
    { id: "coach-attention-25", title: "25 Alerts Handled", description: "Handle 25 needs-attention alerts", rarity: "rare", icon: "target", target: 25, progressKey: "attentionActions" },
    { id: "coach-attention-100", title: "100 Alerts Handled", description: "Handle 100 needs-attention alerts", rarity: "epic", icon: "target", target: 100, progressKey: "attentionActions" },
    { id: "coach-attention-250", title: "250 Alerts Handled", description: "Handle 250 needs-attention alerts", rarity: "legendary", icon: "target", target: 250, progressKey: "attentionActions" },

    // Video feedback
    { id: "coach-video-1", title: "First Video Feedback", description: "Send video feedback on a client check-in", rarity: "common", icon: "trophy", target: 1, progressKey: "videoCheckInReviews" },
    { id: "coach-video-10", title: "10 Video Reviews", description: "Send video feedback on 10 client check-ins", rarity: "rare", icon: "trophy", target: 10, progressKey: "videoCheckInReviews" },

    // Coaching tenure
    { id: "coach-one-month", title: "One Month Coaching", description: "Coach for 30 days with at least one client", rarity: "common", icon: "calendar" },
    { id: "coach-six-months", title: "Six Months Coaching", description: "Coach for 6 months with at least one client", rarity: "rare", icon: "calendar" },
    { id: "coach-one-year", title: "One Year Coaching", description: "Coach for one year with at least one client", rarity: "epic", icon: "calendar" },
];

export const TOTAL_COACH_ACHIEVEMENTS = COACH_ACHIEVEMENT_DEFINITIONS.length;

export function evaluateCoachAchievement(def: CoachAchievementDefinition, stats: CoachAchievementStats): boolean {
    if (def.id === "coach-one-month") {
        return stats.coachAccountAgeDays >= 30 && stats.activeClients >= 1;
    }
    if (def.id === "coach-six-months") {
        return stats.coachAccountAgeDays >= 183 && stats.activeClients >= 1;
    }
    if (def.id === "coach-one-year") {
        return stats.coachAccountAgeDays >= 365 && stats.activeClients >= 1;
    }

    if (def.target != null && def.progressKey) {
        const value = stats[def.progressKey];
        return typeof value === "number" && value >= def.target;
    }

    return false;
}

export function getCoachAchievementProgress(
    def: CoachAchievementDefinition,
    stats: CoachAchievementStats
): { current: number; target: number } | null {
    if (def.id === "coach-one-month") {
        return { current: Math.min(stats.coachAccountAgeDays, 30), target: 30 };
    }
    if (def.id === "coach-six-months") {
        return { current: Math.min(stats.coachAccountAgeDays, 183), target: 183 };
    }
    if (def.id === "coach-one-year") {
        return { current: Math.min(stats.coachAccountAgeDays, 365), target: 365 };
    }

    if (def.target != null && def.progressKey) {
        const value = stats[def.progressKey];
        const current = typeof value === "number" ? value : 0;
        return { current: Math.min(current, def.target), target: def.target };
    }

    return null;
}

export function coachAchievementRarityCounts(): Record<AchievementRarity, number> {
    return COACH_ACHIEVEMENT_DEFINITIONS.reduce(
        (acc, def) => {
            acc[def.rarity] += 1;
            return acc;
        },
        { common: 0, rare: 0, epic: 0, legendary: 0 } as Record<AchievementRarity, number>
    );
}
