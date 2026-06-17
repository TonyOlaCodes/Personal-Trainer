"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Search, Flame } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/RoleContext";
import { formatRelative, roleLabels, roleBadgeClass } from "@/lib/utils";


interface TopBarProps {
    title?: string;
    subtitle?: string;
    streak?: number;
    hideSearch?: boolean;
}

interface NotificationItem {
    id: string;
    type: string;
    message: string;
    createdAt: string;
    read: boolean;
    entityType: string;
    entityId?: string | null;
    route: string;
}

export function TopBar({ title, subtitle, streak, hideSearch = false }: TopBarProps) {
    const router = useRouter();
    const role = useRole();
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const notifRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        let cancelled = false;
        async function loadNotifications() {
            try {
                const res = await fetch("/api/notifications?limit=10");
                if (!res.ok || cancelled) return;
                const data = await res.json();
                setNotifications(data.notifications || []);
                setUnreadCount(data.unreadCount || 0);
            } catch (error) {
                console.error("Failed to load notifications", error);
            }
        }

        loadNotifications();
        const interval = setInterval(loadNotifications, 30000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const handleNotificationClick = async (notification: NotificationItem) => {
        await fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: notification.id }),
        });
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - (notification.read ? 0 : 1)));
        setShowNotifications(false);

        const fallbackRoute = notification.route || "/";
        router.push(fallbackRoute);
    };

    const markAllRead = async () => {
        await fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markAll: true }),
        });
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    return (
        <header className="h-16 flex items-center justify-between px-6 border-b border-surface-border bg-surface-card/80 glass sticky top-0 z-30">
            <div className="flex items-center gap-4">
                <div>
                    {title && <h1 className="text-base font-semibold text-fg">{title}</h1>}
                    {subtitle && <p className="text-xs text-fg-muted">{subtitle}</p>}
                </div>
                {streak !== undefined && streak > 0 && (
                    <div 
                        title="Your training streak — consecutive days with at least one workout logged."
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 cursor-help group transition-all hover:bg-orange-500/20"
                    >
                        <Flame className="w-4 h-4 fill-current transition-transform group-hover:scale-110" />
                        <span className="text-sm font-black italic tracking-tighter">{streak}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">
                <div className="hidden sm:block">
                    <span className={roleBadgeClass[role] ?? "badge-muted"}>
                        {roleLabels[role] ?? role}
                    </span>
                </div>

                <div className="flex items-center gap-1 sm:pl-3 sm:border-l sm:border-surface-border">
                    {!hideSearch && (
                        <button className="btn-icon" aria-label="Search">
                            <Search className="w-4 h-4" />
                        </button>
                    )}
                    
                    <div className="relative" ref={notifRef}>
                        <button 
                            className="btn-icon relative" 
                            aria-label="Notifications"
                            onClick={() => setShowNotifications(!showNotifications)}
                        >
                            <Bell className="w-4 h-4" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-brand-500 rounded-full text-[10px] font-black text-white flex items-center justify-center border border-surface-card">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className="absolute right-0 mt-2 w-80 bg-surface-elevated border border-surface-border rounded-2xl shadow-modal overflow-hidden animate-slide-up z-50">
                                <div className="p-4 border-b border-surface-border bg-surface-card flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-fg">Notifications</h3>
                                    {unreadCount > 0 && (
                                        <span className="text-[10px] text-brand-400 font-bold uppercase tracking-widest bg-brand-400/10 px-2 py-0.5 rounded-full">
                                            {unreadCount} New
                                        </span>
                                    )}
                                </div>
                                <div className="max-h-80 overflow-y-auto no-scrollbar">
                                    {notifications.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <p className="text-sm text-fg-muted">No notifications yet.</p>
                                        </div>
                                    ) : notifications.map((n) => (
                                        <button
                                            key={n.id}
                                            onClick={() => handleNotificationClick(n)}
                                            className={`w-full text-left p-4 border-b border-surface-border hover:bg-surface-muted transition-colors ${!n.read ? "bg-brand-950/10" : ""}`}
                                        >
                                            <div className="flex items-start justify-between mb-1">
                                                <p className={`text-sm ${!n.read ? "font-bold text-fg" : "font-medium text-fg-muted"}`}>{n.message}</p>
                                                {!n.read && <span className="w-2 h-2 rounded-full bg-brand-400 mt-1.5 shrink-0" />}
                                            </div>
                                            <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest">{formatRelative(n.createdAt)}</p>
                                        </button>
                                    ))}
                                </div>
                                <div className="p-2 bg-surface-card text-center border-t border-surface-border">
                                    <button onClick={markAllRead} className="text-xs font-bold text-brand-400 hover:text-brand-300 transition-colors uppercase tracking-widest p-2">Mark all read</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="md:hidden ml-1">
                        <UserButton userProfileMode="navigation" userProfileUrl="/settings" />
                    </div>
                </div>
            </div>
        </header>
    );
}
