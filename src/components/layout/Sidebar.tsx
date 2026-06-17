"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
    LayoutDashboard,
    Dumbbell,
    Calendar,
    BarChart3,
    MessageSquare,
    ClipboardList,
    Settings,
    Zap,
    ShieldCheck,
    Users,
    Video,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "@/components/shared/RoleSwitcher";

interface NavItem {
    href: string;
    label: string;
    icon: React.ElementType;
    roles?: string[];
    hideRoles?: string[];
    badge?: string;
}

const navItems: NavItem[] = [
    { href: "/admin", label: "Admin", icon: ShieldCheck, roles: ["COACH", "SUPER_ADMIN"] },
    { href: "/admin/exercises", label: "Exercises", icon: Video, roles: ["COACH", "SUPER_ADMIN"] },
    { href: "/coach", label: "Coach Panel", icon: Users, roles: ["COACH", "SUPER_ADMIN"] },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hideRoles: ["COACH", "SUPER_ADMIN"] },
    { href: "/plans", label: "Plans", icon: Dumbbell },
    { href: "/calendar", label: "Calendar", icon: Calendar, hideRoles: ["COACH", "SUPER_ADMIN"] },
    { href: "/progress", label: "Progress", icon: BarChart3, hideRoles: ["COACH", "SUPER_ADMIN"] },
    { href: "/checkins", label: "Check-ins", icon: ClipboardList },
    { href: "/chat", label: "Chat", icon: MessageSquare },
];

interface SidebarProps {
    userRole?: string;
    realRole?: string;
    isClientMode?: boolean;
    initialCollapsed?: boolean;
}

export function Sidebar({ userRole = "FREE", realRole = "FREE", isClientMode = false, initialCollapsed = false }: SidebarProps) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(initialCollapsed);

    // Sync collapsed state to document style property and cookie
    useEffect(() => {
        document.documentElement.style.setProperty('--sidebar-width', collapsed ? '72px' : '260px');
        document.cookie = `sidebarCollapsed=${collapsed}; path=/; max-age=31536000`; // 1 year
    }, [collapsed]);

    const toggleCollapse = () => {
        setCollapsed(!collapsed);
    };

    const filteredRole = isClientMode ? "PREMIUM" : userRole;
    const filteredItems = navItems.filter((item) => {
        if (item.hideRoles && item.hideRoles.includes(filteredRole)) return false;
        if (!item.roles) return true;
        return item.roles.includes(filteredRole);
    });

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
                            FitCoach<span className="text-gradient"> Pro</span>
                        </span>
                    )}
                </Link>
            </div>

            {/* Navigation */}
            <nav className={cn("flex-1 py-4 space-y-1 overflow-y-auto no-scrollbar", collapsed ? "px-1.5" : "px-3")}>
                {filteredItems.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            id={`nav-${item.label.toLowerCase().replace(" ", "")}`}
                            href={item.href}
                            className={cn(
                                active ? "sidebar-link-active" : "sidebar-link",
                                collapsed ? "w-10 h-10 p-0 mx-auto justify-center gap-0" : "gap-3"
                            )}
                            title={collapsed ? item.label : undefined}
                        >
                            <item.icon className="w-4.5 h-4.5 flex-shrink-0" style={{ width: "1.125rem", height: "1.125rem" }} />
                            {!collapsed && <span className="animate-fade-in">{item.label}</span>}
                            {(item.badge && !collapsed) && (
                                <span className="ml-auto badge-brand text-[10px]">{item.badge}</span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Settings + User */}
            <div className={cn("py-4 border-t border-surface-border space-y-1", collapsed ? "px-1.5" : "px-3")}>
                <Link
                    href="/settings"
                    className={cn(
                        pathname === "/settings" ? "sidebar-link-active" : "sidebar-link",
                        collapsed ? "w-10 h-10 p-0 mx-auto justify-center gap-0" : "gap-3"
                    )}
                    title={collapsed ? "Settings" : undefined}
                >
                    <Settings className="w-4.5 h-4.5 flex-shrink-0" style={{ width: "1.125rem", height: "1.125rem" }} />
                    {!collapsed && <span className="animate-fade-in">Settings</span>}
                </Link>
                <Link
                    href="/settings"
                    className={cn(
                        "flex items-center rounded-xl text-fg-muted hover:bg-surface-muted hover:text-fg transition-all",
                        collapsed ? "w-10 h-10 p-0 mx-auto justify-center gap-0" : "px-3 py-2.5 gap-3"
                    )}
                    title={collapsed ? "Account" : undefined}
                >
                    <UserButton userProfileMode="navigation" userProfileUrl="/settings" />
                    {!collapsed && <span className="text-xs font-semibold animate-fade-in">Account</span>}
                </Link>
            </div>
        </aside>
    );
}