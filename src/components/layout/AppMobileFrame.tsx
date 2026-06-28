"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MobileKeyboardProvider, useMobileKeyboardOpen } from "@/hooks/useMobileKeyboardOpen";
import { MobileTabBar } from "@/components/layout/MobileTabBar";

function MobileMain({ children }: { children: React.ReactNode }) {
    const keyboardOpen = useMobileKeyboardOpen();
    const pathname = usePathname();
    const isChat = pathname.startsWith("/chat");

    return (
        <main
            className={cn(
                "w-full max-w-full min-w-0 md:pb-0",
                isChat
                    ? "max-md:h-dvh max-md:overflow-hidden max-md:pb-0"
                    : cn("min-h-screen", keyboardOpen ? "pb-0" : "pb-20")
            )}
        >
            {children}
        </main>
    );
}

interface AppMobileFrameProps {
    userRole: string;
    children: React.ReactNode;
}

export function AppMobileFrame({ userRole, children }: AppMobileFrameProps) {
    return (
        <MobileKeyboardProvider>
            <MobileMain>{children}</MobileMain>
            <MobileTabBar userRole={userRole} />
        </MobileKeyboardProvider>
    );
}
