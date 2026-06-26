"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search, Flame, Settings } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/RoleContext";
import { formatRelative, roleLabels, roleBadgeClass, formatDate, getDayName, cn } from "@/lib/utils";
import { useCurrentDate } from "@/hooks/useCurrentDate";
import { useScrollLock } from "@/hooks/useScrollLock";
import { getQuickReplyTemplate, supportsQuickReply } from "@/lib/notificationTypes";


interface TopBarProps {
    title?: string;
    subtitle?: string;
    showToday?: boolean;
    streak?: number;
    hideSearch?: boolean;
}

function LiveTodayHeader() {
    const now = useCurrentDate();
    return (
        <div className="min-w-0">
            <h1 className="text-base font-semibold text-fg truncate">{getDayName(now)}</h1>
            <p className="text-xs text-fg-muted truncate">{formatDate(now)}</p>
        </div>
    );
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
    clientId?: string | null;
    quickReplyTemplate?: string | null;
    supportsQuickReply?: boolean;
}

export function TopBar({ title, subtitle, showToday = false, streak, hideSearch = true }: TopBarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const role = useRole();
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
    const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
    const notifRef = useRef<HTMLDivElement>(null);
    const isCoach = role === "COACH" || role === "SUPER_ADMIN";
    const onSettings = pathname.startsWith("/settings");

    useScrollLock(showNotifications);

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

    const getReplyDraft = (notification: NotificationItem) => {
        if (replyDrafts[notification.id] !== undefined) return replyDrafts[notification.id];
        return notification.quickReplyTemplate ?? getQuickReplyTemplate(notification.type);
    };

    const handleNotificationNavigate = async (notification: NotificationItem) => {
        await fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: notification.id }),
        });
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - (notification.read ? 0 : 1)));
        setShowNotifications(false);
        router.push(notification.route || "/");
    };

    const sendQuickReply = async (notification: NotificationItem) => {
        const content = getReplyDraft(notification).trim();
        if (!content || sendingReplyId) return;

        setSendingReplyId(notification.id);
        try {
            const res = await fetch("/api/notifications/quick-reply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notificationId: notification.id, content }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error ?? "Could not send message");
                return;
            }

            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - (notification.read ? 0 : 1)));
            setReplyDrafts(prev => {
                const next = { ...prev };
                delete next[notification.id];
                return next;
            });

            if (data.chatRoute) {
                setShowNotifications(false);
                router.push(data.chatRoute);
            }
        } catch (error) {
            console.error("Quick reply failed", error);
            alert("Could not send message");
        } finally {
            setSendingReplyId(null);
        }
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
        <header className="h-16 flex items-center justify-between gap-2 px-4 sm:px-6 border-b border-surface-border bg-surface-card/80 glass sticky top-0 z-30 w-full max-w-full min-w-0">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                {showToday ? (
                    <LiveTodayHeader />
                ) : (
                    <div className="min-w-0">
                        {title && <h1 className="text-base font-semibold text-fg truncate">{title}</h1>}
                        {subtitle && <p className="text-xs text-fg-muted truncate">{subtitle}</p>}
                    </div>
                )}
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

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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

                    <Link
                        href="/settings"
                        className={cn(
                            "btn-icon md:hidden",
                            onSettings && "text-brand-400 bg-brand-500/10"
                        )}
                        aria-label="Settings"
                        aria-current={onSettings ? "page" : undefined}
                    >
                        <Settings className="w-4 h-4" />
                    </Link>
                    
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
                            <div className="fixed left-1/2 top-16 z-50 w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 bg-surface-elevated border border-surface-border rounded-2xl shadow-modal overflow-hidden animate-slide-up md:absolute md:left-auto md:right-0 md:top-auto md:mt-2 md:translate-x-0 md:w-96">
                                <div className="p-4 border-b border-surface-border bg-surface-card flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-fg">Notifications</h3>
                                    {unreadCount > 0 && (
                                        <span className="text-[10px] text-brand-400 font-bold uppercase tracking-widest bg-brand-400/10 px-2 py-0.5 rounded-full">
                                            {unreadCount} New
                                        </span>
                                    )}
                                </div>
                                <div className="max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain no-scrollbar">
                                    {notifications.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <p className="text-sm text-fg-muted">No notifications yet.</p>
                                        </div>
                                    ) : notifications.map((n) => {
                                        const canQuickReply = isCoach && (n.supportsQuickReply ?? supportsQuickReply(n.type));
                                        return (
                                            <div
                                                key={n.id}
                                                className={cn(
                                                    "p-4 border-b border-surface-border",
                                                    !n.read && "bg-brand-950/10"
                                                )}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => handleNotificationNavigate(n)}
                                                    className="w-full text-left hover:opacity-90 transition-opacity"
                                                >
                                                    <div className="flex items-start justify-between mb-1 gap-2 min-w-0">
                                                        <p className={cn("text-sm break-words min-w-0 flex-1", !n.read ? "font-bold text-fg" : "font-medium text-fg-muted")}>
                                                            {n.message}
                                                        </p>
                                                        {!n.read && <span className="w-2 h-2 rounded-full bg-brand-400 mt-1.5 shrink-0" />}
                                                    </div>
                                                    <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest">
                                                        {formatRelative(n.createdAt)}
                                                    </p>
                                                </button>

                                                {canQuickReply && (
                                                    <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                                                        <textarea
                                                            value={getReplyDraft(n)}
                                                            onChange={(e) => setReplyDrafts(prev => ({ ...prev, [n.id]: e.target.value }))}
                                                            rows={2}
                                                            className="input text-xs resize-none py-2"
                                                            placeholder="Write a follow-up..."
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => sendQuickReply(n)}
                                                            disabled={sendingReplyId === n.id || !getReplyDraft(n).trim()}
                                                            className="btn-primary btn-sm w-full"
                                                        >
                                                            {sendingReplyId === n.id ? "Sending..." : "Send quick message"}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
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
