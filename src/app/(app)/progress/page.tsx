import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { ProgressClient } from "./ProgressClient";

export const metadata = { 
    title: "Progress & Analytics | Performance Tracker",
    description: "Visualise your strength progression, volume splits, and training consistency."
};

export default async function ProgressPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const user = await prisma.user.findUnique({ 
        where: { clerkId: userId },
        select: { role: true }
    });
    
    if (!user) redirect("/sign-in");

    return (
        <div className="bg-surface-base min-h-screen">
            <TopBar 
                title="Training Progress" 
                subtitle="Data-driven insights to help you break plateaus" 
            />
            <main className="animate-fade-in">
                <ProgressClient userRole={user.role} />
            </main>
        </div>
    );
}
