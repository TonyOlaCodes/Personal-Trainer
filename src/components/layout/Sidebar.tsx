"use client";

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
    Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
    href: string;
    label: string;
    icon: React.ElementType;
    roles?: string[];
    badge?: string;
    view?: "client" | "coach" | "admin" | "all";
}

const navItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, view: "client" },
    { href: "/plans", label: "Plans", icon: Dumbbell, view: "client" },
    { href: "/calendar", label: "Calendar", icon: Calendar, view: "client" },
    { href: "/progress", label: "Progress", icon: BarChart3, view: "client" },
    { href: "/checkins", label: "Check-ins", icon: ClipboardList, view: "client" },
    { href: "/chat", label: "Chat", icon: MessageSquare, view: "all" },
    { href: "/admin", label: "Admin", icon: ShieldCheck, roles: ["SUPER_ADMIN"], view: "admin" },
    { href: "/admin/exercises", label: "Exercises", icon: Video, roles: ["SUPER_ADMIN"], view: "admin" },
    { href: "/coach", label: "Coach Panel", icon: Users, roles: ["COACH", "SUPER_ADMIN"], view: "coach" },
    { href: "/donate", label: "Support", icon: Heart, view: "client" },
];

interface SidebarProps {
    userRole?: string;
}

export function Sidebar({ userRole = "FREE" }: SidebarProps) {
    const pathname = usePathname();
    const isCoachView = pathname.startsWith("/coach");
    const isAdminView = pathname.startsWith("/admin");

    const filteredItems = navItems.filter((item) => {
        // Role check
        if (item.roles && !item.roles.includes(userRole)) return false;

        // View mode check
        if (isAdminView) return item.view === "admin" || item.view === "all";
        if (isCoachView) return item.view === "coach" || item.view === "all";
        
        return item.view === "all" || item.view === "client";
    });

    return (
        <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-[var(--sidebar-width)] bg-surface-card border-r border-surface-border z-40">
            {/* Logo */}
            <div className="h-16 flex items-center px-5 border-b border-surface-border">
                <Link href="/" className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-sm">
                        <Zap className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-base tracking-tight">
                        FitCoach<span className="text-gradient"> Pro</span>
                    </span>
                </Link>
            </div>

            {/* View Switcher for Coaches */}
            {(userRole === "COACH" || userRole === "SUPER_ADMIN") && (
                <div className="px-3 pt-4 pb-2">
                    {pathname.startsWith("/coach") ? (
                        <Link
                            href="/dashboard"
                            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-surface-card hover:bg-surface-hover border border-surface-border transition-all group"
                        >
                            <LayoutDashboard className="w-4 h-4 text-fg-muted group-hover:text-brand" />
                            <span className="text-xs font-semibold text-fg-muted group-hover:text-fg">Client Dashboard</span>
                        </Link>
                    ) : (
                        <Link
                            href="/coach"
                            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 transition-all group"
                        >
                            <Users className="w-4 h-4 text-brand" />
                            <span className="text-xs font-semibold text-brand">Coach Panel</span>
                        </Link>
                    )}
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
                {filteredItems.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(active ? "sidebar-link-active" : "sidebar-link")}
                        >
                            <item.icon className="w-4.5 h-4.5 flex-shrink-0" style={{ width: "1.125rem", height: "1.125rem" }} />
                            <span>{item.label}</span>
                            {item.badge && (
                                <span className="ml-auto badge-brand text-[10px]">{item.badge}</span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Settings + User */}
            <div className="px-3 py-4 border-t border-surface-border space-y-1">
                <Link
                    href="/settings"
                    className={cn(pathname === "/settings" ? "sidebar-link-active" : "sidebar-link")}
                >
                    <Settings className="w-4.5 h-4.5 flex-shrink-0" style={{ width: "1.125rem", height: "1.125rem" }} />
                    <span>Settings</span>
                </Link>
                <div className="flex items-center gap-3 px-3 py-2.5">
                    <UserButton />
                    <span className="text-xs text-fg-muted">Account</span>
                </div>
            </div>
        </aside>
    );
}
