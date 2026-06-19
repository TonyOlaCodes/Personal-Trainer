import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma, ensureDbSchema } from "@/lib/prisma";
import { cookies } from "next/headers";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { RoleProvider } from "@/lib/RoleContext";
import { getUserDeactivationStatusByClerkId, ensureUserAccountStatusColumns } from "@/lib/userDeactivation";
import { SafeFallback } from "@/components/shared/SafeFallback";

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await ensureDbSchema();
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    let user: { role: string; onboardingDone: boolean; id: string } | null = null;
    let isDeactivated = false;
    let accountLookupFailed = false;
    try {
        user = await prisma.user.findUnique({
            where: { clerkId: userId },
            select: { role: true, onboardingDone: true, id: true },
        });
        isDeactivated = await getUserDeactivationStatusByClerkId(userId);
        await ensureUserAccountStatusColumns();
    } catch (e) {
        accountLookupFailed = true;
        console.error("[AppLayout] Failed to load account state:", e);
    }

    if (accountLookupFailed) {
        return <SafeFallback title="Account" />;
    }

    if (isDeactivated) {
        redirect("/deactivated");
    }

    if (!user?.onboardingDone) {
        redirect("/onboarding");
    }

    const cookieStore = await cookies();
    const isClientMode = cookieStore.get("viewMode")?.value === "CLIENT";

    const isSidebarCollapsed = cookieStore.get("sidebarCollapsed")?.value === "true";

    const realRole = (user?.role as "FREE" | "PREMIUM" | "COACH" | "SUPER_ADMIN") ?? "FREE";
    let effectiveRole = realRole;

    if (["COACH", "SUPER_ADMIN"].includes(realRole) && isClientMode) {
        effectiveRole = "PREMIUM";
    }

    return (
        <RoleProvider role={effectiveRole}>
            <div className="min-h-screen bg-surface">
                {/* Prevent layout shifts by injecting sidebar width before browser renders */}
                <style dangerouslySetInnerHTML={{ __html: `:root { --sidebar-width: ${isSidebarCollapsed ? '72px' : '260px'}; }` }} />
                <Sidebar userRole={effectiveRole} realRole={realRole} isClientMode={isClientMode} initialCollapsed={isSidebarCollapsed} />

                <div className="md:pl-[var(--sidebar-width)]">
                    <main className="min-h-screen pb-20 md:pb-0">
                        {children}
                    </main>
                </div>

                <MobileTabBar userRole={effectiveRole} realRole={realRole} isClientMode={isClientMode} />
            </div>
        </RoleProvider>
    );
}
