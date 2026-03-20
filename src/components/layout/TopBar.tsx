"use client";

import { Bell, Search } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { useRole } from "@/lib/RoleContext";
import { roleLabels, roleBadgeClass } from "@/lib/utils";


interface TopBarProps {
    title?: string;
    subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
    const role = useRole();

    return (
        <header className="h-16 flex items-center justify-between px-6 border-b border-surface-border bg-surface-card/80 glass sticky top-0 z-30">
            <div>
                {title && <h1 className="text-base font-semibold text-fg">{title}</h1>}
                {subtitle && <p className="text-xs text-fg-muted">{subtitle}</p>}
            </div>

            <div className="flex items-center gap-3">
                <div className="hidden sm:block">
                    <span className={roleBadgeClass[role] ?? "badge-muted"}>
                        {roleLabels[role] ?? role}
                    </span>
                </div>

                <div className="flex items-center gap-1 sm:pl-3 sm:border-l sm:border-surface-border">
                    <button className="btn-icon" aria-label="Search">
                        <Search className="w-4 h-4" />
                    </button>
                    <button className="btn-icon relative" aria-label="Notifications">
                        <Bell className="w-4 h-4" />
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand-400 rounded-full" />
                    </button>
                    <div className="lg:hidden ml-1">
                        <UserButton />
                    </div>
                </div>
            </div>
        </header>
    );
}
