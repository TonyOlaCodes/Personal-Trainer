import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { SettingsClient } from "./SettingsClient";
import { getDailyMetricTargets } from "@/lib/dailyMetrics";
import { ensureNotificationPreferenceColumns } from "@/lib/notifications";
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

        const dailyMetricTargets = await getDailyMetricTargets(user.id);
        const hiddenGoals = (user as any).hiddenGoals ?? [];
        const cookieStore = await cookies();
        const isClientMode = cookieStore.get("viewMode")?.value === "CLIENT";
        const realRole = user.role as "FREE" | "PREMIUM" | "COACH" | "SUPER_ADMIN";

        return (
            <>
                <TopBar title="Settings" subtitle="Manage your account preferences" />
                <SettingsClient
                    user={{ ...user, hiddenGoals, ...dailyMetricTargets }}
                    realRole={realRole}
                    isClientMode={isClientMode}
                />
            </>
        );
    } catch (e) {
        rethrowNextInternalErrors(e);
        console.error("[SettingsPage] Error:", e);
        return <SafeFallback title="Settings" errorDetails={formatErrorDetails(e)} />;
    }
}
