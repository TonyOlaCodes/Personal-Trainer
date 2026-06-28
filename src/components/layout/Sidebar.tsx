"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Dumbbell,
    Calendar,
    BarChart3,
    MessageSquare,
    ClipboardList,
    Zap,
    ShieldCheck,
    Users,
    Video,
    ChevronLeft,
    ChevronRight,
    UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveNavHref } from "@/lib/navActive";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useChatUnread, formatUnreadBadge } from "@/components/chat/ChatUnreadProvider";
import { AccountNav } from "@/components/layout/AccountNav";

interface NavItem {
    href: string;
    label: string;
    icon: React.ElementType;
    roles?: string[];
    hideRoles?: string[];
    requiresCheckIns?: boolean;
    badge?: string;
    exact?: boolean;
}

const navItems: NavItem[] = [
    { href: "/admin", label: "Admin", icon: ShieldCheck, roles: ["SUPER_ADMIN"], exact: true },
    { href: "/admin/exercises", label: "Exercises", icon: Video, roles: ["SUPER_ADMIN"] },
    { href: "/coach", label: "Coach Panel", icon: Users, roles: ["COACH", "SUPER_ADMIN"] },
    { href: "/coach/invites", label: "Invites", icon: UserPlus, roles: ["COACH", "SUPER_ADMIN"] },
    { href: "/coach/calendar", label: "Calendar", icon: Calendar, roles: ["COACH", "SUPER_ADMIN"] },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hideRoles: ["COACH", "SUPER_ADMIN"] },
    { href: "/plans", label: "Plans", icon: Dumbbell },
    { href: "/calendar", label: "Calendar", icon: Calendar, hideRoles: ["COACH", "SUPER_ADMIN"] },
    { href: "/progress", label: "Progress", icon: BarChart3, hideRoles: ["COACH", "SUPER_ADMIN"] },
    { href: "/checkins", label: "Check-ins", icon: ClipboardList, requiresCheckIns: true },
    { href: "/chat", label: "Chat", icon: MessageSquare },
];

interface SidebarProps {
    userRole?: string;
    showCheckIns?: boolean;
    initialCollapsed?: boolean;
}

export function Sidebar({ userRole = "FREE", showCheckIns = false, initialCollapsed = false }: SidebarProps) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(initialCollapsed);
    const { totalUnread } = useChatUnread();
    const chatBadge = formatUnreadBadge(totalUnread);

    // Sync collapsed state to document style property and cookie
    useEffect(() => {
        document.documentElement.style.setProperty('--sidebar-width', collapsed ? '72px' : '260px');
        document.cookie = `sidebarCollapsed=${collapsed}; path=/; max-age=31536000`; // 1 year
    }, [collapsed]);

    const toggleCollapse = () => {
        setCollapsed(!collapsed);
    };

    const filteredItems = navItems.filter((item) => {
        if (item.requiresCheckIns && !showCheckIns) return false;
        if (item.hideRoles && item.hideRoles.includes(userRole)) return false;
        if (!item.roles) return true;
        return item.roles.includes(userRole);
    });

    const activeHref = getActiveNavHref(pathname, filteredItems);

    return (
        <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-[var(--sidebar-width)] bg-surface-card border-r border-surface-border z-40 transition-all duration-300">
            {/* Collapse Toggle Button - Floating on border */}
            <button 
                onClick={toggleCollapse}
                className="absolute -right-3 top-5 w-6 h-6 rounded-full bg-surface-card border border-surface-border flex items-center justify-center text-fg-subtle hover:text-fg shadow-md hover:scale-110 transition-all z-50 cursor-pointer"
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>

            {/* Logo */}
            <div className={cn("h-16 flex items-center border-b border-surface-border", collapsed ? "justify-center px-0" : "px-5")}>
                <Link href={userRole === "COACH" || userRole === "SUPER_ADMIN" ? "/coach" : "/dashboard"} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-sm">
                        <Zap className="w-4 h-4 text-white" />
                    </div>
                    {!collapsed && (
                        <span className="font-bold text-base tracking-tight animate-fade-in">
                            <BrandLogo />
                        </span>
                    )}
                </Link>
            </div>

            {/* Navigation */}
            <nav className={cn("flex-1 py-4 space-y-1 overflow-y-auto no-scrollbar", collapsed ? "px-1.5" : "px-3")}>
                {filteredItems.map((item) => {
                    const active = item.href === activeHref;
                    const badge = item.href === "/chat" ? chatBadge : item.badge;
                    return (
                        <Link
                            key={item.href}
                            id={`nav-${item.label.toLowerCase().replace(" ", "")}`}
                            href={item.href}
                            className={cn(
                                active ? "sidebar-link-active" : "sidebar-link",
                                collapsed ? "w-10 h-10 p-0 mx-auto justify-center gap-0 relative" : "gap-3"
                            )}
                            title={collapsed ? item.label : undefined}
                        >
                            <item.icon className="w-4.5 h-4.5 flex-shrink-0" style={{ width: "1.125rem", height: "1.125rem" }} />
                            {collapsed && badge && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-brand-500 text-white text-[9px] font-black flex items-center justify-center">
                                    {badge}
                                </span>
                            )}
                            {!collapsed && <span className="animate-fade-in">{item.label}</span>}
                            {(badge && !collapsed) && (
                                <span className="ml-auto badge-brand text-[10px]">{badge}</span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Account */}
            <div className={cn("py-4 border-t border-surface-border", collapsed ? "px-1.5" : "px-3")}>
                <AccountNav collapsed={collapsed} />
            </div>
        </aside>
    );
}