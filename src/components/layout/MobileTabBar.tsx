"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Dumbbell,
    Calendar,
    BarChart3,
    MessageSquare,
    Users
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileNavItem {
    href: string;
    label: string;
    icon: React.ElementType;
    roles?: string[];
    hideRoles?: string[];
}

const mobileNavItems: MobileNavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hideRoles: ["COACH", "SUPER_ADMIN"] },
    { href: "/coach", label: "Coach", icon: Users, roles: ["COACH", "SUPER_ADMIN"] },
    { href: "/plans", label: "Plans", icon: Dumbbell },
    { href: "/checkins", label: "Check-ins", icon: Calendar },
    { href: "/progress", label: "Progress", icon: BarChart3, hideRoles: ["COACH", "SUPER_ADMIN"] },
    { href: "/chat", label: "Chat", icon: MessageSquare },
];

import { RoleSwitcher } from "@/components/shared/RoleSwitcher";

interface MobileTabBarProps {
    userRole?: string;
    realRole?: string;
    isClientMode?: boolean;
}

export function MobileTabBar({ userRole = "FREE", realRole = "FREE", isClientMode = false }: MobileTabBarProps) {
    const pathname = usePathname();

    const filteredRole = isClientMode ? "PREMIUM" : userRole;
    const filteredItems = mobileNavItems.filter((item) => {
        if (item.hideRoles && item.hideRoles.includes(filteredRole)) return false;
        if (!item.roles) return true;
        return item.roles.includes(filteredRole);
    });

    return (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 glass glass-border border-t border-surface-border safe-area-pb">
            <div className="flex items-center justify-around px-2 py-2 overflow-x-auto no-scrollbar">
                {filteredItems.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            id={`nav-${item.label.toLowerCase().replace(" ", "")}`}
                            href={item.href}
                            className={cn(active ? "tab-bar-item-active" : "tab-bar-item")}
                        >
                            <item.icon className="w-5 h-5" />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
                {(realRole === "COACH" || realRole === "SUPER_ADMIN") && (
                    <div className="flex flex-col items-center justify-center gap-1 min-w-[3.5rem] mt-1">
                        <RoleSwitcher realRole={realRole as any} isClientMode={isClientMode} compact />
                        <span className="text-[9px] text-fg-muted font-medium mt-0.5 whitespace-nowrap overflow-visible">Switch</span>
                    </div>
                )}
            </div>
        </nav>
    );
}
