import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { SettingsClient } from "./SettingsClient";
import { getDailyMetricTargets } from "@/lib/dailyMetrics";
import { ensureNotificationPreferenceColumns, getCoachNotifyOnClientMessage } from "@/lib/notifications";
import { ensureUserProfileColumns } from "@/lib/userProfile";
import { SafeFallback, rethrowNextInternalErrors } from "@/components/shared/SafeFallback";
import { formatErrorDetails } from "@/lib/ensureAppSchema";


export const metadata = { title: "Settings" };

export default async function SettingsPage() {
    try {
        const { userId } = await auth();
        if (!userId) redirect("/sign-in");

        let user = null;
        try {
            user = await prisma.user.findUnique({
                where: { clerkId: userId },
                select: {
                    id: true,
                    name: true, email: true, role: true, onboardingDone: true, avatarUrl: true,
                    goal: true, trainingDaysPerWeek: true, experienceLevel: true, trainingLocation: true,
                    targetWeightKg: true, weightKg: true,
                    hiddenGoals: true,
                    notifyOnWorkout: true,
                    notifyOnCheckIn: true,
                    notifyOnMetricUpdate: true,
                    notifyOnCoachMessage: true,
                    notifyOnPlanUpdate: true,
                    notifyOnCheckInReview: true,
                    notifyOnWorkoutFeedback: true,
                    notifyOnMissedCheckIn: true,
                    notifyOnMissedWorkout: true,
                    notifyOnWorkoutTime: true,
                    notifyOnCheckInTime: true,
                    notifyOnMetricUpdateTime: true,
                    notifyOnMissedCheckInTime: true,
                    notifyOnMissedWorkoutTime: true,
                    bio: true,
                    isPrivateProfile: true,
                },
            });
        } catch (dbErr) {
            console.warn("[SettingsPage] Failed to fetch user with hiddenGoals, retrying without it:", dbErr);
            try {
                user = await prisma.user.findUnique({
                    where: { clerkId: userId },
                    select: {
                        id: true,
                        name: true, email: true, role: true, onboardingDone: true, avatarUrl: true,
                        goal: true, trainingDaysPerWeek: true, experienceLevel: true, trainingLocation: true,
                        targetWeightKg: true, weightKg: true,
                    },
                });
            } catch (dbErr2) {
                console.error("[SettingsPage] Failed to fetch user profile completely:", dbErr2);
            }
        }

        if (!user) redirect("/sign-in");

        await ensureNotificationPreferenceColumns();
        await ensureUserProfileColumns();

        const dailyMetricTargets = await getDailyMetricTargets(user.id);
        const hiddenGoals = (user as any).hiddenGoals ?? [];
        const notifyOnClientMessage = await getCoachNotifyOnClientMessage(user.id);

        return (
            <>
                <TopBar title="Settings" subtitle="Manage your account preferences" />
                <SettingsClient
                    user={{ ...user, hiddenGoals, notifyOnClientMessage, ...dailyMetricTargets }}
                />
            </>
        );
    } catch (e) {
        rethrowNextInternalErrors(e);
        console.error("[SettingsPage] Error:", e);
        return <SafeFallback title="Settings" errorDetails={formatErrorDetails(e)} />;
    }
}
