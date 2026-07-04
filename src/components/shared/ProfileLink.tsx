"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { cn, getChatRoleLabel, getInitials, getRoleBadgeClass, getRoleNameClass } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import { getPublicProfileHref } from "@/lib/profileNavigation";

/**
 * Links to a user's public profile. Use only in social contexts (chat, search,
 * profile pages). For the logged-in user's own account in app navigation, use
 * AccountNav or link to /settings instead.
 */
interface ProfileLinkProps {
    userId: string;
    name?: ReactNode;
    avatarUrl?: string | null;
    role?: string;
    className?: string;
    nameClassName?: string;
    showAvatar?: boolean;
    avatarSize?: "xs" | "sm" | "md" | "lg";
    showRoleLabel?: boolean;
    showRoleBadge?: boolean;
    stopPropagation?: boolean;
    disabled?: boolean;
}

const AVATAR_SIZES = {
    xs: "w-7 h-7 text-[10px]",
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-xs",
    lg: "w-16 h-16 text-lg",
};

export function ProfileLink({
    userId,
    name,
    avatarUrl,
    role,
    className,
    nameClassName,
    showAvatar = false,
    avatarSize = "sm",
    showRoleLabel = false,
    showRoleBadge = false,
    stopPropagation = false,
    disabled = false,
}: ProfileLinkProps) {
    const displayName = typeof name === "string" ? (name.trim() || "User") : name;
    const initialsSource = typeof name === "string" ? name : "User";
    const roleLabel = role ? getChatRoleLabel(role) : null;
    const content = (
        <>
            {showAvatar && (
                <span
                    className={cn(
                        "rounded-full bg-gradient-brand flex items-center justify-center font-bold text-white overflow-hidden shrink-0",
                        AVATAR_SIZES[avatarSize]
                    )}
                >
                    {avatarUrl ? (
                        <img src={resolveUploadUrl(avatarUrl)} alt={typeof displayName === "string" ? displayName : "User"} className="w-full h-full object-cover" />
                    ) : (
                        getInitials(initialsSource)
                    )}
                </span>
            )}
            <span className="inline-flex items-center gap-1.5 min-w-0">
                <span className={cn(role && getRoleNameClass(role), nameClassName)}>{displayName}</span>
                {showRoleLabel && roleLabel && (
                    <span className={cn("text-[10px] font-black uppercase tracking-wider", getRoleNameClass(role))}>
                        <span className="text-fg-subtle">·</span> {roleLabel}
                    </span>
                )}
            </span>
            {showRoleBadge && roleLabel && (
                <span className={cn(
                    "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                    getRoleBadgeClass(role ?? "")
                )}>
                    {roleLabel}
                </span>
            )}
        </>
    );

    if (disabled || !userId) {
        return (
            <span className={cn("inline-flex items-center gap-2 min-w-0", className)}>
                {content}
            </span>
        );
    }

    return (
        <Link
            href={getPublicProfileHref(userId)}
            className={cn(
                "inline-flex items-center gap-2 min-w-0 hover:opacity-85 transition-opacity",
                className
            )}
            onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
        >
            {content}
        </Link>
    );
}
