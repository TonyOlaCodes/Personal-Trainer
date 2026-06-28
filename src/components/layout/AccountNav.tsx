"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import { useAppUser } from "@/lib/AppUserContext";
import { getAccountNavHref, isSettingsPath } from "@/lib/profileNavigation";

type Props = {
    variant?: "sidebar" | "header";
    collapsed?: boolean;
};

export function AccountNav({ variant = "sidebar", collapsed = false }: Props) {
    const user = useAppUser();
    const pathname = usePathname();

    if (!user?.id) return null;

    const accountHref = getAccountNavHref();
    const onSettings = isSettingsPath(pathname);
    const displayName = user.name?.trim() || user.email || "Account";
    const accountLabel = user.name?.trim()?.split(" ")[0] ?? "Account";

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
                href={accountHref}
                className={cn(
                    "rounded-full transition-opacity hover:opacity-90",
                    onSettings && "ring-2 ring-brand-400/60 ring-offset-2 ring-offset-surface-card"
                )}
                aria-label="Open settings"
                title="Settings"
            >
                {avatar}
            </Link>
        );
    }

    return (
        <Link
            href={accountHref}
            className={cn(
                onSettings ? "sidebar-link-active" : "sidebar-link",
                collapsed ? "w-10 h-10 p-0 mx-auto justify-center gap-0" : "gap-3",
                collapsed && "flex"
            )}
            title={collapsed ? accountLabel : undefined}
            aria-label="Open settings"
        >
            {avatar}
            {!collapsed && (
                <span className="text-xs font-semibold animate-fade-in truncate">{accountLabel}</span>
            )}
        </Link>
    );
}
