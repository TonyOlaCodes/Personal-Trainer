import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { RoleProvider } from "@/lib/RoleContext";

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    // Gracefully fetch user — app still renders even without a real DB
    let user: { role: string; onboardingDone: boolean; id: string } | null = null;
    try {
        user = await prisma.user.findUnique({
            where: { clerkId: userId },
            select: { role: true, onboardingDone: true, id: true },
        });
    } catch (e) {
        // DB not yet connected — treat as new user
        console.warn("[AppLayout] DB unreachable, treating as new user:", e);
    }

    return (
        <RoleProvider role={user?.role ?? "FREE"}>
            <div className="min-h-screen bg-surface">
                <Sidebar userRole={(user?.role as "FREE" | "PREMIUM" | "COACH" | "SUPER_ADMIN") ?? "FREE"} />

                <div className="lg:pl-[var(--sidebar-width)]">
                    <main className="min-h-screen pb-20 lg:pb-0">
                        {children}
                    </main>
                </div>

                <MobileTabBar />
            </div>
        </RoleProvider>
    );
}
