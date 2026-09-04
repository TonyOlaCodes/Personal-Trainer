import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
    getFeaturedAchievementKeys,
    getUserAchievementsDisplay,
    type ProgressiveDisplayItem,
} from "@/lib/achievements";
import { isCoachRole } from "@/lib/roles";
import { AchievementsPageClient } from "./AchievementsPageClient";
import { SafeFallback, rethrowNextInternalErrors } from "@/components/shared/SafeFallback";
import { formatErrorDetails } from "@/lib/ensureAppSchema";

export const metadata = { title: "Achievements" };

export default async function AchievementsPage() {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) redirect("/sign-in");

        const user = await prisma.user.findUnique({
            where: { clerkId },
            select: { id: true, role: true },
        });
        if (!user) redirect("/sign-in");

        if (isCoachRole(user.role)) {
            redirect(`/profile/${user.id}?achievements=1`);
        }

        const [achievements, featuredKeys] = await Promise.all([
            getUserAchievementsDisplay(user.id),
            getFeaturedAchievementKeys(user.id),
        ]);

        const progressive = achievements.filter(
            (a): a is ProgressiveDisplayItem =>
                "kind" in a && (a.kind === "progressive" || a.kind === "special")
        );

        return (
            <Suspense fallback={null}>
                <AchievementsPageClient
                    initialAchievements={progressive}
                    featuredKeys={featuredKeys}
                    canFeature
                />
            </Suspense>
        );
    } catch (e) {
        rethrowNextInternalErrors(e);
        return <SafeFallback title="Achievements" errorDetails={formatErrorDetails(e)} />;
    }
}
