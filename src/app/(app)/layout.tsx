import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppMobileFrame } from "@/components/layout/AppMobileFrame";
import { RoleProvider } from "@/lib/RoleContext";
import { getUserDeactivationStatusByClerkId } from "@/lib/userDeactivation";
import { ensureAppSchema, formatErrorDetails } from "@/lib/ensureAppSchema";
import { SafeFallback } from "@/components/shared/SafeFallback";
import { deactivateCoachActivePlans, isCoachRole, canAccessCheckIns } from "@/lib/roles";
import { touchUserLastActive } from "@/lib/userPresence";
import { PresenceHeartbeat } from "@/components/layout/PresenceHeartbeat";
import { GlobalAnnouncements } from "@/components/shared/GlobalAnnouncements";
import { ChatUnreadProvider } from "@/components/chat/ChatUnreadProvider";
import { AppUserProvider } from "@/lib/AppUserContext";

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await ensureAppSchema();
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    let user: {
        role: string;
        coachId: string | null;
        onboardingDone: boolean;
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
    } | null = null;
    let isDeactivated = false;
    let layoutError: unknown = null;
    try {
        user = await prisma.user.findUnique({
            where: { clerkId: userId },
            select: {
                role: true,
                coachId: true,
                onboardingDone: true,
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
            },
        });
        isDeactivated = await getUserDeactivationStatusByClerkId(userId);
    } catch (e) {
        layoutError = e;
        console.error("[AppLayout] Failed to load account state:", e);
    }

    if (layoutError) {
        return <SafeFallback title="Account" errorDetails={formatErrorDetails(layoutError)} />;
    }

    if (isDeactivated) {
        redirect("/deactivated");
    }

    if (!user?.onboardingDone) {
        redirect("/onboarding");
    }

    const cookieStore = await cookies();

    const isSidebarCollapsed = cookieStore.get("sidebarCollapsed")?.value === "true";

    const userRole = user?.role ?? "FREE";
    const showCheckIns = user ? canAccessCheckIns(user.role, user.coachId) : false;

    if (isCoachRole(userRole)) {
        await deactivateCoachActivePlans(user.id);
    }

    await touchUserLastActive(user.id);

    return (
        <RoleProvider role={userRole}>
            <AppUserProvider
                user={{
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    avatarUrl: user.avatarUrl,
                }}
            >
            <ChatUnreadProvider>
            <PresenceHeartbeat />
            <GlobalAnnouncements />
            <div className="min-h-screen bg-surface w-full max-w-full">
                {/* Prevent layout shifts by injecting sidebar width before browser renders */}
                <style dangerouslySetInnerHTML={{ __html: `:root { --sidebar-width: ${isSidebarCollapsed ? '72px' : '260px'}; }` }} />
                <Sidebar userRole={userRole} showCheckIns={showCheckIns} initialCollapsed={isSidebarCollapsed} />

                <div className="md:pl-[var(--sidebar-width)] w-full max-w-full min-w-0">
                    <AppMobileFrame userRole={userRole}>
                        {children}
                    </AppMobileFrame>
                </div>
            </div>
            </ChatUnreadProvider>
            </AppUserProvider>
        </RoleProvider>
    );
}
