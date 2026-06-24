import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { ProgressClient } from "./ProgressClient";
import { SafeFallback, rethrowNextInternalErrors } from "@/components/shared/SafeFallback";
import { formatErrorDetails } from "@/lib/ensureAppSchema";

export const metadata = {
    title: "Progress",
    description: "Track bodyweight, strength PRs, workout consistency, and training volume.",
};

export default async function ProgressPage() {
    try {
        const { userId } = await auth();
        if (!userId) redirect("/sign-in");

        let user = null;
        try {
            user = await prisma.user.findUnique({ 
                where: { clerkId: userId },
                select: { role: true, hiddenGoals: true }
            });
        } catch (dbErr) {
            console.warn("[ProgressPage] Failed to fetch user with hiddenGoals, retrying with role only:", dbErr);
            try {
                user = await prisma.user.findUnique({
                    where: { clerkId: userId },
                    select: { role: true }
                });
            } catch (dbErr2) {
                console.error("[ProgressPage] Failed to fetch user completely:", dbErr2);
            }
        }
        
        if (!user) redirect("/sign-in");

        if (user.role === "COACH" || user.role === "SUPER_ADMIN") {
            redirect("/coach");
        }

        const hiddenGoals = (user as any).hiddenGoals ?? [];

        return (
            <div className="bg-surface-base min-h-screen">
                <TopBar 
                    title="Progress" 
                    subtitle="Am I improving?" 
                />
                <main className="animate-fade-in">
                    <ProgressClient userRole={user.role} hiddenGoals={hiddenGoals} />
                </main>
            </div>
        );
    } catch (e) {
        rethrowNextInternalErrors(e);
        console.error("[ProgressPage] Error:", e);
        return <SafeFallback title="Progress" errorDetails={formatErrorDetails(e)} />;
    }
}
