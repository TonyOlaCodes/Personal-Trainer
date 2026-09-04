import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { SettingsClient } from "./SettingsClient";
import { getClientGoalTargets } from "@/lib/clientGoalTargets";
import { ensureNotificationPreferenceColumns, getCoachNotifyOnClientMessage } from "@/lib/notifications";
import { ensureUserProfileColumns } from "@/lib/userProfile";
import {
    ensureProfileExtendedColumns,
    getUserSocialLinks,
} from "@/lib/profilePrivacy";
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
                    name: true, email: true, role: true, coachId: true, onboardingDone: true, avatarUrl: true,
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
        await ensureProfileExtendedColumns();

        const dailyMetricTargets = await getClientGoalTargets(user.id);
        const hiddenGoals = (user as any).hiddenGoals ?? [];
        const notifyOnClientMessage = await getCoachNotifyOnClientMessage(user.id);

        const [socialLinks, bannerRows] = await Promise.all([
            getUserSocialLinks(user.id),
            prisma.$queryRaw<Array<{ bannerUrl: string | null }>>`
                SELECT "bannerUrl" FROM "users" WHERE "id" = ${user.id} LIMIT 1
            `,
        ]);
        const bannerUrl = bannerRows[0]?.bannerUrl ?? null;

        return (
            <>
                <TopBar title="Settings" subtitle="Manage your account preferences" />
                <Suspense fallback={null}>
                    <SettingsClient
                        user={{
                            ...user,
                            hiddenGoals,
                            notifyOnClientMessage,
                            bannerUrl,
                            socialLinks,
                            ...dailyMetricTargets,
                        }}
                    />
                </Suspense>
            </>
        );
    } catch (e) {
        rethrowNextInternalErrors(e);
        console.error("[SettingsPage] Error:", e);
        return <SafeFallback title="Settings" errorDetails={formatErrorDetails(e)} />;
    }
}
