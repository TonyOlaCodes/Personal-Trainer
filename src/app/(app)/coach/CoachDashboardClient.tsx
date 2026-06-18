"use client";

import { useState } from "react";
import {
    Users, Activity, Calendar,
    ChevronRight, TrendingUp, HelpCircle, CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { cn, formatDate, getInitials } from "@/lib/utils";

interface Client {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    isDeleted?: boolean;
    hasCheckInSchedule?: boolean;
    goal?: string | null;
    currentWeightKg?: number | null;
    targetWeightKg?: number | null;
    stats: { logs: number; checkins: number };
    recentLogs: { id: string; workoutName: string; date: string; setCount: number }[];
    recentCheckIns: { id: string; week: number; date: string; status: string; bodyweightKg?: number | null }[];
    bodyweightHistory: { date: string; weightKg: number }[];
}

interface RecentCheckIn {
    id: string;
    clientName: string;
    week: number;
    date: string;
    status: string;
}

interface Props {
    clients: Client[];
    recentCheckIns: RecentCheckIn[];
}

export function CoachDashboardClient({ clients, recentCheckIns }: Props) {
    const pendingCheckIns = recentCheckIns.filter(ci => ci.status === "Pending").length;
    const activeClients = clients.filter(c => !c.isDeleted);
    const deletedClients = clients.filter(c => c.isDeleted);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card">
                    <div className="flex justify-between items-start">
                        <Users className="w-4 h-4 text-brand-400 mb-1" />
                        <Link href="/coach/invites" className="text-[10px] font-black text-brand-400 hover:text-brand-300 transition-colors uppercase tracking-widest">
                            Invite +
                        </Link>
                    </div>
                    <p className="stat-value">{activeClients.length}</p>
                    <p className="stat-label">Active Clients</p>
                </div>
                <div className="stat-card">
                    <TrendingUp className="w-4 h-4 text-success mb-1" />
                    <p className="stat-value">{pendingCheckIns}</p>
                    <p className="stat-label">Pending Reviews</p>
                </div>
                <div className="stat-card">
                    <Activity className="w-4 h-4 text-warning mb-1" />
                    <p className="stat-value">{activeClients.reduce((acc, c) => acc + c.stats.logs, 0)}</p>
                    <p className="stat-label">Logs (Total)</p>
                </div>
                <div className="stat-card">
                    <Calendar className="w-4 h-4 text-brand-300 mb-1" />
                    <p className="stat-value">{activeClients.reduce((acc, c) => acc + c.stats.checkins, 0)}</p>
                    <p className="stat-label">Check-ins (Total)</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Client Roster */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="heading-3">My Stable</h3>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        {clients.length === 0 ? (
                            <div className="col-span-2 card p-10 text-center">
                                <p className="text-fg-muted">You have no clients assigned yet.</p>
                            </div>
                        ) : (
                            clients.map((c) => (
                                <Link
                                    key={c.id}
                                    href={`/coach/client/${c.id}`}
                                    className={cn(
                                        "card p-5 group transition-all",
                                        c.isDeleted
                                            ? "opacity-70 grayscale hover:border-surface-border"
                                            : "hover:border-brand-600/40"
                                    )}
                                >
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white shadow-glow-sm overflow-hidden",
                                            c.isDeleted ? "bg-surface-muted text-fg-subtle" : "bg-gradient-brand"
                                        )}>
                                            {c.avatarUrl ? <img src={c.avatarUrl} alt="avatar" className="w-full h-full object-cover rounded-2xl" /> : getInitials(c.name)}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-fg group-hover:text-brand-400 transition-colors truncate">{c.name}</p>
                                                {c.isDeleted && (
                                                    <span className="badge-muted text-[9px] uppercase tracking-widest">Deleted</span>
                                                )}
                                                {!c.isDeleted && !c.hasCheckInSchedule && (
                                                    <span className="text-[8px] uppercase font-black px-2 py-0.5 rounded-full border border-warning/30 bg-warning/10 text-warning shrink-0">
                                                        Schedule needed
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-fg-muted truncate">{c.isDeleted ? "Inactive account" : c.email}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 border-t border-surface-border pt-4">
                                        <div>
                                            <p className="text-[10px] text-fg-subtle uppercase font-bold tracking-widest">Logs</p>
                                            <p className="text-sm font-semibold text-fg">{c.stats.logs}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-fg-subtle uppercase font-bold tracking-widest">Check-ins</p>
                                            <p className="text-sm font-semibold text-fg">{c.stats.checkins}</p>
                                        </div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                    {deletedClients.length > 0 && (
                        <p className="px-2 text-xs text-fg-subtle">
                            Deleted clients are kept here as inactive markers only; their account data has been removed.
                        </p>
                    )}
                </div>

                {/* Recent Check-ins Sidebar */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="heading-3">Quick Reviews</h3>
                        <Link href="/checkins" className="text-xs text-brand-400 hover:underline">See all</Link>
                    </div>
                    <div className="space-y-3">
                        {recentCheckIns.map((ci) => (
                            <Link
                                key={ci.id}
                                href={`/checkins?highlight=${ci.id}`}
                                className={cn(
                                    "block card p-4 border transition-all",
                                    ci.status === "Pending" ? "border-brand-600/30 bg-brand-500/5 shadow-glow-brand-sm" : "hover:bg-surface-muted/30"
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Week {ci.week} Check-in</span>
                                            {ci.status === "Pending" ? (
                                                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse shadow-glow-brand" />
                                            ) : (
                                                <CheckCircle2 className="w-3 h-3 text-success/60" />
                                            )}
                                        </div>
                                        <p className="font-black text-fg truncate text-sm">{ci.clientName}</p>
                                    </div>
                                    <div className="text-right">
                                        {ci.status === "Pending" ? (
                                            <span className="badge-brand text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest">Review</span>
                                        ) : (
                                            <span className="badge text-success bg-success/10 border-success/20 text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest">Done</span>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-surface-border/50 flex items-center justify-between text-[10px] text-fg-muted font-black uppercase tracking-widest">
                                    <span className="text-fg-subtle italic">{formatDate(ci.date)}</span>
                                    <div className="flex items-center gap-1 group text-brand-400">
                                        {ci.status === "Pending" ? "Perform Review" : "View Submission"} 
                                        <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    <div className="card p-6 bg-surface-muted/30 border-2 border-dashed border-surface-border text-center grayscale opacity-60">
                        <HelpCircle className="w-8 h-8 mx-auto mb-3 text-fg-subtle" />
                        <p className="text-xs font-bold uppercase text-fg-subtle tracking-widest">Pro Analytics</p>
                        <p className="text-xs text-fg-subtle mt-1">Client compliance graphs coming soon</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
