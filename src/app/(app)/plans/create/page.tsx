import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { PlanCreateClient } from "./PlanCreateClient";

export const metadata = { title: "Create Plan" };

export default async function CreatePlanPage({
    searchParams,
}: {
    searchParams: Promise<{ view?: string }>;
}) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) redirect("/sign-in");

    const params = await searchParams;
    const isReview = params.view === "true";

    return (
        <>
            <TopBar
                title={isReview ? "Review Plan" : "New Workout Plan"}
                subtitle={isReview ? "Browse sessions by day" : "Build a custom programme or follow a template"}
            />
            <Suspense
                fallback={
                    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                        <p className="text-fg-muted animate-pulse">Loading plan editor...</p>
                    </div>
                }
            >
                <PlanCreateClient viewerId={user.id} viewerRole={user.role} />
            </Suspense>
        </>
    );
}
