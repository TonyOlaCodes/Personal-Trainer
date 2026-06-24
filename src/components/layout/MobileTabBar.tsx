"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Dumbbell,
    Calendar,
    BarChart3,
    MessageSquare,
    Users,
    ClipboardList,
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
    { href: "/calendar", label: "Calendar", icon: Calendar, hideRoles: ["COACH", "SUPER_ADMIN"] },
    { href: "/checkins", label: "Check-ins", icon: ClipboardList },
    { href: "/progress", label: "Progress", icon: BarChart3, hideRoles: ["COACH", "SUPER_ADMIN"] },
    { href: "/chat", label: "Chat", icon: MessageSquare },
];

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
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 glass glass-border border-t border-surface-border safe-area-pb">
            <div className="flex items-center justify-around px-2 py-2 overflow-hidden gap-1 w-full max-w-full">
                {filteredItems.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            id={`nav-${item.label.toLowerCase().replace(" ", "")}`}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tight transition-all duration-200 flex-1 min-w-0",
                                active 
                                    ? "text-brand-400 bg-brand-500/10" 
                                    : "text-fg-subtle hover:text-fg hover:bg-surface-muted/50"
                            )}
                        >
                            <item.icon className={cn("w-4.5 h-4.5 transition-transform duration-200 shrink-0", active && "scale-110")} />
                            <span className="truncate w-full text-center leading-none">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
