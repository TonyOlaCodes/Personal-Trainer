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
    { href: "/admin", label: "Admin", icon: ShieldCheck, roles: ["SUPER_ADMIN"] },
    { href: "/admin/exercises", label: "Exercises", icon: Video, roles: ["SUPER_ADMIN"] },
    { href: "/coach", label: "Coach Panel", icon: Users, roles: ["COACH", "SUPER_ADMIN"] },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hideRoles: ["COACH", "SUPER_ADMIN"] },
    { href: "/plans", label: "Plans", icon: Dumbbell },
    { href: "/calendar", label: "Calendar", icon: Calendar },
    { href: "/progress", label: "Progress", icon: BarChart3, hideRoles: ["COACH", "SUPER_ADMIN"] },
    { href: "/checkins", label: "Check-ins", icon: ClipboardList },
    { href: "/chat", label: "Chat", icon: MessageSquare },
];

interface SidebarProps {
    userRole?: string;
    realRole?: string;
    isClientMode?: boolean;
}

export function Sidebar({ userRole = "FREE", realRole = "FREE", isClientMode = false }: SidebarProps) {
    const pathname = usePathname();

    const filteredRole = isClientMode ? "PREMIUM" : userRole;
    const filteredItems = navItems.filter((item) => {
        if (item.hideRoles && item.hideRoles.includes(filteredRole)) return false;
        if (!item.roles) return true;
        return item.roles.includes(filteredRole);
    });

    return (
        <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-[var(--sidebar-width)] bg-surface-card border-r border-surface-border z-40">
            {/* Logo */}
            <div className="h-16 flex items-center px-5 border-b border-surface-border">
                <Link href={userRole === "COACH" || userRole === "SUPER_ADMIN" ? "/coach" : "/dashboard"} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-sm">
                        <Zap className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-base tracking-tight">
                        FitCoach<span className="text-gradient"> Pro</span>
                    </span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
                {filteredItems.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            id={`nav-${item.label.toLowerCase().replace(" ", "")}`}
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
                {(realRole === "COACH" || realRole === "SUPER_ADMIN") && (
                    <div className="mb-2">
                        <RoleSwitcher realRole={realRole as any} isClientMode={isClientMode} />
                    </div>
                )}
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