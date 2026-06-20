import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { PlanCreateClient } from "./PlanCreateClient";

export const metadata = { title: "Create Plan" };

export default async function CreatePlanPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) redirect("/sign-in");

    return (
        <>
            <TopBar title="New Workout Plan" subtitle="Build a custom programme or follow a template" />
            <Suspense
                fallback={
                    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                        <p className="text-fg-muted animate-pulse">Loading plan editor...</p>
                    </div>
                }
            >
                <PlanCreateClient />
            </Suspense>
        </>
    );
}
