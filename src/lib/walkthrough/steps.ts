export type WalkthroughStepPosition = "top" | "bottom" | "left" | "right";

export type WalkthroughStep = {
    id: string;
    route: string;
    targetId: string;
    title: string;
    description: string;
    position: WalkthroughStepPosition;
    /** When true, the Finish button completes the tour on this step. */
    isFinish?: boolean;
};

export const CLIENT_WALKTHROUGH_STEPS: WalkthroughStep[] = [
    {
        id: "dashboard-workout",
        route: "/dashboard",
        targetId: "tour-dashboard-workout",
        title: "Today's workout",
        description:
            "Your daily mission lives here. See what's scheduled, resume an in-progress session, or start today's workout in one tap.",
        position: "bottom",
    },
    {
        id: "dashboard-metrics",
        route: "/dashboard",
        targetId: "tour-dashboard-metrics",
        title: "Daily metrics",
        description:
            "Log bodyweight, calories, steps, and sleep quickly. These feed your progress charts and help your coach track trends.",
        position: "bottom",
    },
    {
        id: "dashboard-activity",
        route: "/dashboard",
        targetId: "tour-dashboard-activity",
        title: "Recent activity",
        description:
            "Review completed sessions, durations, and quick summaries. Tap any workout to revisit sets and notes.",
        position: "top",
    },
    {
        id: "dashboard-notifications",
        route: "/dashboard",
        targetId: "tour-notifications",
        title: "Notifications",
        description:
            "Stay on top of coach messages, plan updates, check-in reminders, and workout feedback without leaving the app.",
        position: "bottom",
    },
    {
        id: "plans-overview",
        route: "/plans",
        targetId: "tour-plans-overview",
        title: "Your training plan",
        description:
            "View your assigned programme, training split, and upcoming workouts. Switch plans or explore templates when your coach allows.",
        position: "bottom",
    },
    {
        id: "calendar-overview",
        route: "/calendar",
        targetId: "tour-calendar-overview",
        title: "Workout calendar",
        description:
            "See scheduled sessions, completed workouts, missed days, and check-in due dates in one calendar view.",
        position: "bottom",
    },
    {
        id: "checkins-overview",
        route: "/checkins",
        targetId: "tour-checkins-overview",
        title: "Weekly check-ins",
        description:
            "Submit bodyweight, progress photos, and weekly notes. Your coach reviews them and leaves feedback here.",
        position: "bottom",
    },
    {
        id: "progress-overview",
        route: "/progress",
        targetId: "tour-progress-overview",
        title: "Progress analytics",
        description:
            "Track exercise history, estimated 1RM, PRs, bodyweight trends, and volume charts to see what's improving over time.",
        position: "bottom",
    },
    {
        id: "chat-overview",
        route: "/chat",
        targetId: "tour-chat-overview",
        title: "Coach chat",
        description:
            "Message your coach directly, share photos and videos, discuss plans, and keep your conversation history in one place.",
        position: "bottom",
    },
    {
        id: "finish-workout",
        route: "/dashboard",
        targetId: "tour-dashboard-workout",
        title: "You're ready to train",
        description:
            "That's the full tour. Start your first workout now — your coach can refine the plan as you log sessions.",
        position: "bottom",
        isFinish: true,
    },
];

export function getWalkthroughStepLabel(stepIndex: number, total: number): string {
    return `Step ${stepIndex + 1} of ${total}`;
}
