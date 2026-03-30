"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Search, Flame } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { useRole } from "@/lib/RoleContext";
import { roleLabels, roleBadgeClass } from "@/lib/utils";


interface TopBarProps {
    title?: string;
    subtitle?: string;
    streak?: number;
}

export function TopBar({ title, subtitle, streak }: TopBarProps) {
    const role = useRole();
    const [showNotifications, setShowNotifications] = useState(false);
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
                    <button className="btn-icon" aria-label="Search">
                        <Search className="w-4 h-4" />
                    </button>
                    
                    <div className="relative" ref={notifRef}>
                        <button 
                            className="btn-icon relative" 
                            aria-label="Notifications"
                            onClick={() => setShowNotifications(!showNotifications)}
                        >
                            <Bell className="w-4 h-4" />
                            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand-400 rounded-full" />
                        </button>

                        {showNotifications && (
                            <div className="absolute right-0 mt-2 w-80 bg-surface-elevated border border-surface-border rounded-2xl shadow-modal overflow-hidden animate-slide-up z-50">
                                <div className="p-4 border-b border-surface-border bg-surface-card flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-fg">Notifications</h3>
                                    <span className="text-[10px] text-brand-400 font-bold uppercase tracking-widest bg-brand-400/10 px-2 py-0.5 rounded-full">New</span>
                                </div>
                                <div className="max-h-80 overflow-y-auto no-scrollbar">
                                    {[
                                        { title: "Welcome to FitCoach Pro!", desc: "Set up your profile and explore the new features.", time: "Just now", unread: true },
                                        { title: "Workout Reminder", desc: "Don't forget your scheduled Leg Day tomorrow.", time: "2 hours ago" },
                                        { title: "Platform Update", desc: "Global exercises and video tutorials are now live.", time: "1 day ago" }
                                    ].map((n, i) => (
                                        <div key={i} className={`p-4 border-b border-surface-border hover:bg-surface-muted transition-colors cursor-pointer ${n.unread ? "bg-brand-950/10" : ""}`}>
                                            <div className="flex items-start justify-between mb-1">
                                                <p className={`text-sm ${n.unread ? "font-bold text-fg" : "font-medium text-fg-muted"}`}>{n.title}</p>
                                                {n.unread && <span className="w-2 h-2 rounded-full bg-brand-400 mt-1.5" />}
                                            </div>
                                            <p className="text-xs text-fg-subtle line-clamp-2 leading-relaxed mb-2">{n.desc}</p>
                                            <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest">{n.time}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-2 bg-surface-card text-center border-t border-surface-border">
                                    <button className="text-xs font-bold text-brand-400 hover:text-brand-300 transition-colors uppercase tracking-widest p-2">Mark all read</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="lg:hidden ml-1">
                        <UserButton />
                    </div>
                </div>
            </div>
        </header>
    );
}
