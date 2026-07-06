"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Search, X, Trophy } from "lucide-react";
import { StreakBadge } from "@/components/shared/StreakBadge";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/RoleContext";
import { AccountNav } from "@/components/layout/AccountNav";
import { formatRelative, roleLabels, roleBadgeClass, formatDate, getDayName, cn } from "@/lib/utils";
import { useCurrentDate } from "@/hooks/useCurrentDate";
import { getQuickReplyTemplate, supportsQuickReply, NOTIFICATION_TYPES } from "@/lib/notificationTypes";
import { GainAccessModal } from "@/components/shared/GainAccessModal";


interface TopBarProps {
    title?: string;
    subtitle?: string;
    showToday?: boolean;
    streak?: number;
    hideSearch?: boolean;
}

function PlanAssignedNotificationText({ message }: { message: string }) {
    const coachName = message || "Your coach";
    return (
        <>
            <span className="font-bold text-fg">{coachName}</span>
            <span className="text-brand-400 font-black tracking-wide"> (Coach)</span>
            <span className="text-fg-muted font-medium"> — Assigned you a new plan</span>
        </>
    );
}

function CoachMessageNotificationText({ message }: { message: string }) {
    const coachName = message === "New message from your coach" ? "Your coach" : message;
    return (
        <>
            <span className="font-bold text-fg">{coachName}</span>
            <span className="text-brand-400 font-black tracking-wide"> (Coach)</span>
            <span className="text-fg-muted font-medium"> — New message</span>
        </>
    );
}

function CoachBroadcastNotificationText({ message }: { message: string }) {
    if (message === "Admin") {
        return (
            <>
                <span className="text-fg-muted font-medium">Message from </span>
                <span className="font-bold text-fg">Admin</span>
                <span className="text-warning font-bold"> — Important broadcast</span>
            </>
        );
    }

    const coachName = message || "Your coach";
    return (
        <>
            <span className="text-fg-muted font-medium">From coach · </span>
            <span className="font-bold text-fg">{coachName}</span>
            <span className="text-warning font-bold"> — Important broadcast</span>
        </>
    );
}

function AnnouncementNotificationText({ message }: { message: string }) {
    const match = message.match(/^Message from (.+?):/);
    if (!match) return <span>{message}</span>;
    const rest = message.slice(match[0].length).trim();
    return (
        <>
            <span className="text-fg-muted font-medium">Message from </span>
            <span className="font-bold text-fg">{match[1]}</span>
            {rest && <span className="text-fg-muted font-medium"> — {rest}</span>}
        </>
    );
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

function resolveNotificationRoute(notification: NotificationItem): string {
    if (notification.type === NOTIFICATION_TYPES.CLIENT_MISSED_WORKOUT) {
        const clientId =
            notification.clientId
            ?? (notification.entityType === "USER" ? notification.entityId?.split(":")[0] : null);
        if (clientId) return `/chat?with=${clientId}`;
    }
    return notification.route || "/";
}

export function TopBar({ title, subtitle, showToday = false, streak, hideSearch = true }: TopBarProps) {
    const router = useRouter();
    const role = useRole();
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
    const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showGainAccess, setShowGainAccess] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);
    const isCoach = role === "COACH" || role === "SUPER_ADMIN";

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
        router.push(resolveNotificationRoute(notification));
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

    const deleteNotificationItem = async (notification: NotificationItem) => {
        if (deletingId) return;
        setDeletingId(notification.id);
        try {
            const res = await fetch(`/api/notifications?id=${encodeURIComponent(notification.id)}`, {
                method: "DELETE",
            });
            if (!res.ok) return;

            setNotifications(prev => prev.filter(n => n.id !== notification.id));
            if (!notification.read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
            setReplyDrafts(prev => {
                const next = { ...prev };
                delete next[notification.id];
                return next;
            });
        } catch (error) {
            console.error("Failed to delete notification", error);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
        <header className="fixed top-0 left-0 right-0 md:left-[var(--sidebar-width)] h-16 flex items-center justify-between gap-2 px-4 sm:px-6 border-b border-surface-border bg-surface-card/80 glass z-40 min-w-0 overflow-visible">
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
                    <StreakBadge streak={streak} size="md" />
                )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="flex items-center gap-2">
                    <span className={roleBadgeClass[role] ?? "badge-muted"}>
                        {roleLabels[role] ?? role}
                    </span>
                    {role === "FREE" && (
                        <button
                            type="button"
                            onClick={() => setShowGainAccess(true)}
                            className="text-[10px] font-black uppercase tracking-widest text-brand-400 hover:text-brand-300 transition-colors whitespace-nowrap"
                        >
                            Gain access
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-1 sm:pl-3 sm:border-l sm:border-surface-border">
                    {!hideSearch && (
                        <button className="btn-icon" aria-label="Search">
                            <Search className="w-4 h-4" />
                        </button>
                    )}
                    
                    <div className="relative" ref={notifRef} id="tour-notifications">
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
                            <>
                            <button
                                type="button"
                                className="fixed inset-0 z-40 bg-black/40 md:hidden"
                                aria-label="Close notifications"
                                onClick={() => setShowNotifications(false)}
                            />
                            <div className="fixed left-1/2 top-[4.25rem] z-50 w-[calc(100vw-2rem)] max-w-sm max-h-[min(calc(100dvh-5.5rem),28rem)] -translate-x-1/2 bg-surface-elevated border border-surface-border rounded-2xl shadow-modal overflow-hidden animate-slide-up flex flex-col md:absolute md:left-auto md:right-0 md:top-full md:translate-x-0 md:mt-2 md:w-96 md:max-h-[min(70vh,28rem)]">
                                <div className="p-4 border-b border-surface-border bg-surface-card flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-fg">Notifications</h3>
                                    {unreadCount > 0 && (
                                        <span className="text-[10px] text-brand-400 font-bold uppercase tracking-widest bg-brand-400/10 px-2 py-0.5 rounded-full">
                                            {unreadCount} New
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar">
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
                                                    "p-4 border-b border-surface-border relative group",
                                                    !n.read && "bg-brand-950/10"
                                                )}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteNotificationItem(n);
                                                    }}
                                                    disabled={deletingId === n.id}
                                                    className="absolute top-3 right-3 p-1 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-muted opacity-60 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-all disabled:opacity-40"
                                                    aria-label="Delete notification"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleNotificationNavigate(n)}
                                                    className="w-full text-left hover:opacity-90 transition-opacity pr-6"
                                                >
                                                    <div className="flex items-start justify-between mb-1 gap-2 min-w-0">
                                                        <p className={cn("text-sm break-words min-w-0 flex-1", !n.read ? "font-bold text-fg" : "font-medium text-fg-muted")}>
                                                            {n.type === NOTIFICATION_TYPES.NEW_CHAT_MESSAGE ? (
                                                                <CoachMessageNotificationText message={n.message} />
                                                            ) : n.type === NOTIFICATION_TYPES.COACH_BROADCAST ? (
                                                                <CoachBroadcastNotificationText message={n.message} />
                                                            ) : n.type === NOTIFICATION_TYPES.PLAN_ASSIGNED ? (
                                                                <PlanAssignedNotificationText message={n.message} />
                                                            ) : n.type === NOTIFICATION_TYPES.GLOBAL_ANNOUNCEMENT ? (
                                                                <AnnouncementNotificationText message={n.message} />
                                                            ) : n.type === NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED ? (
                                                                <span className="inline-flex items-start gap-1.5">
                                                                    <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                                                    <span>{n.message}</span>
                                                                </span>
                                                            ) : (
                                                                n.message
                                                            )}
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
                                <div className="p-2 bg-surface-card text-center border-t border-surface-border shrink-0">
                                    <button onClick={markAllRead} className="text-xs font-bold text-brand-400 hover:text-brand-300 transition-colors uppercase tracking-widest p-2">Mark all read</button>
                                </div>
                            </div>
                            </>
                        )}
                    </div>

                    <div className="md:hidden ml-1">
                        <AccountNav variant="header" />
                    </div>
                </div>
            </div>

            <GainAccessModal open={showGainAccess} onClose={() => setShowGainAccess(false)} />
        </header>
        <div
            className="shrink-0 h-[calc(4rem+var(--maintenance-banner-height,0px)+var(--maintenance-below-topbar-gap,0px))]"
            aria-hidden="true"
        />
        </>
    );
}
