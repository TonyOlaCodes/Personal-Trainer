import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { SettingsClient } from "./SettingsClient";
import { getDailyMetricTargets } from "@/lib/dailyMetrics";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: {
            id: true,
            name: true, email: true, role: true, onboardingDone: true, avatarUrl: true,
            goal: true, trainingDaysPerWeek: true, experienceLevel: true, trainingLocation: true,
            targetWeightKg: true, weightKg: true,
        },
    });

    if (!user) redirect("/sign-in");

    const dailyMetricTargets = await getDailyMetricTargets(user.id);

    return (
        <>
            <TopBar title="Settings" subtitle="Manage your account preferences" />
            <SettingsClient user={{ ...user, ...dailyMetricTargets }} />
        </>
    );
}
