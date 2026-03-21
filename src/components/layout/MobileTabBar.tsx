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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/RoleContext";

export function MobileTabBar() {
    const pathname = usePathname();
    const userRole = useRole();

    const mobileNavItems = [
        { href: "/dashboard", label: "Home", icon: LayoutDashboard },
        { href: "/plans", label: "Plans", icon: Dumbbell },
        { href: "/checkins", label: "Check-ins", icon: Calendar },
        { href: "/progress", label: "Progress", icon: BarChart3 },
        { href: "/chat", label: "Chat", icon: MessageSquare },
    ];

    // Add Coach Panel to mobile if user is a coach
    if (userRole === "COACH" || userRole === "SUPER_ADMIN") {
        mobileNavItems.splice(1, 0, { href: "/coach", label: "Coach", icon: Users });
    }

    return (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 glass glass-border border-t border-surface-border safe-area-pb">
            <div className="flex items-center justify-around px-2 py-2">
                {mobileNavItems.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(active ? "tab-bar-item-active" : "tab-bar-item")}
                        >
                            <item.icon className="w-5 h-5" />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
