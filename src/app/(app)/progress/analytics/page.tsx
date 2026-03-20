import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { AnalyticsClient } from "./AnalyticsClient";

export const metadata = {
    title: "Analytics | Performance Tracker",
    description: "Visualise your workout progress over time.",
};

export default async function AnalyticsPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    return (
        <div className="min-h-screen bg-surface-base">
            <TopBar 
                title="Performance Analytics" 
                subtitle="Data-driven insights into your fitness journey" 
            />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <AnalyticsClient />
            </main>
        </div>
    );
}
