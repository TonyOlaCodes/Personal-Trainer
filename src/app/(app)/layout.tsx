import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
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

    let user: { role: string; onboardingDone: boolean; id: string } | null = null;
    try {
        user = await prisma.user.findUnique({
            where: { clerkId: userId },
            select: { role: true, onboardingDone: true, id: true },
        });
    } catch (e) {
        console.warn("[AppLayout] DB unreachable, treating as new user:", e);
    }

    const cookieStore = await cookies();
    const isClientMode = cookieStore.get("viewMode")?.value === "CLIENT";

    const realRole = (user?.role as "FREE" | "PREMIUM" | "COACH" | "SUPER_ADMIN") ?? "FREE";
    let effectiveRole = realRole;

    if (["COACH", "SUPER_ADMIN"].includes(realRole) && isClientMode) {
        effectiveRole = "PREMIUM";
    }

    return (
        <RoleProvider role={effectiveRole}>
            <div className="min-h-screen bg-surface">
                <Sidebar userRole={effectiveRole} realRole={realRole} isClientMode={isClientMode} />

                <div className="lg:pl-[var(--sidebar-width)]">
                    <main className="min-h-screen pb-20 lg:pb-0">
                        {children}
                    </main>
                </div>

                <MobileTabBar userRole={effectiveRole} realRole={realRole} isClientMode={isClientMode} />
            </div>
        </RoleProvider>
    );
}
