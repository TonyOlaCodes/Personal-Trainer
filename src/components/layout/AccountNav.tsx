"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import { useAppUser } from "@/lib/AppUserContext";

type Props = {
    variant?: "sidebar" | "header";
    collapsed?: boolean;
};

export function AccountNav({ variant = "sidebar", collapsed = false }: Props) {
    const user = useAppUser();
    const pathname = usePathname();

    if (!user?.id) return null;

    const profileHref = `/profile/${user.id}`;
    const onProfile = pathname === profileHref || pathname.startsWith(`${profileHref}/`);
    const onSettings = pathname === "/settings" || pathname.startsWith("/settings/");
    const displayName = user.name?.trim() || user.email || "Profile";

    const avatar = (
        <span
            className={cn(
                "rounded-full bg-gradient-brand flex items-center justify-center font-bold text-white overflow-hidden shrink-0 border border-surface-border",
                variant === "header" ? "w-8 h-8 text-xs" : collapsed ? "w-8 h-8 text-xs" : "w-9 h-9 text-xs"
            )}
        >
            {user.avatarUrl ? (
                <img
                    src={resolveUploadUrl(user.avatarUrl)}
                    alt={displayName}
                    className="w-full h-full object-cover"
                />
            ) : (
                getInitials(displayName)
            )}
        </span>
    );

    if (variant === "header") {
        return (
            <Link
                href={profileHref}
                className={cn(
                    "rounded-full transition-opacity hover:opacity-90",
                    onProfile && "ring-2 ring-brand-400/60 ring-offset-2 ring-offset-surface-card"
                )}
                aria-label="View your profile"
                title="View profile"
            >
                {avatar}
            </Link>
        );
    }

    return (
        <div className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
            <Link
                href={profileHref}
                className={cn(
                    onProfile ? "sidebar-link-active" : "sidebar-link",
                    collapsed ? "w-10 h-10 p-0 mx-auto justify-center gap-0" : "gap-3"
                )}
                title={collapsed ? "Profile" : undefined}
            >
                {avatar}
                {!collapsed && <span className="text-xs font-semibold animate-fade-in truncate">Profile</span>}
            </Link>
            <Link
                href="/settings"
                className={cn(
                    onSettings ? "sidebar-link-active" : "sidebar-link",
                    collapsed ? "w-10 h-10 p-0 mx-auto justify-center gap-0" : "gap-3"
                )}
                title={collapsed ? "Settings" : undefined}
            >
                <Settings className="w-4.5 h-4.5 flex-shrink-0" style={{ width: "1.125rem", height: "1.125rem" }} />
                {!collapsed && <span className="text-xs font-semibold animate-fade-in">Settings</span>}
            </Link>
        </div>
    );
}
