import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { ProgressClient } from "./ProgressClient";

export const metadata = { 
    title: "Progress & Analytics | Performance Tracker",
    description: "Track bodyweight, strength PRs, workout consistency, and training volume with premium analytics."
};

export default async function ProgressPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const user = await prisma.user.findUnique({ 
        where: { clerkId: userId },
        select: { role: true }
    });
    
    if (!user) redirect("/sign-in");

    if (user.role === "COACH" || user.role === "SUPER_ADMIN") {
        redirect("/coach");
    }

    return (
        <div className="bg-surface-base min-h-screen">
            <TopBar 
                title="Progress" 
                subtitle="Am I improving?" 
            />
            <main className="animate-fade-in">
                <ProgressClient userRole={user.role} />
            </main>
        </div>
    );
}
