"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const MAINTENANCE_BANNER_HEIGHT = "3.5rem";

function formatMaintenanceStart(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "soon";

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function usesOwnTopChrome(pathname: string) {
    return pathname.startsWith("/chat") || /^\/plans\/log\/[^/]+$/.test(pathname);
}

interface MaintenanceBannerProps {
    scheduledAt: string;
}

export function MaintenanceBanner({ scheduledAt }: MaintenanceBannerProps) {
    const pathname = usePathname();
    const belowTopBar = !usesOwnTopChrome(pathname);

    return (
        <div
            className={cn(
                "fixed inset-x-0 z-[35] border-b border-warning/25 bg-warning/10 px-4 py-3 text-center text-xs font-bold leading-relaxed text-fg",
                "md:left-[var(--sidebar-width)]",
                belowTopBar ? "top-16" : "top-0"
            )}
            style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top, 0px))" }}
        >
            Scheduled maintenance starts {formatMaintenanceStart(scheduledAt)}. The app will be unavailable during maintenance.
        </div>
    );
}
