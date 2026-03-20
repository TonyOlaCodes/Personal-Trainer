"use client";

import {
    Users, Activity, Calendar, MessageSquare,
    ChevronRight, ArrowUpRight, TrendingUp, HelpCircle
} from "lucide-react";
import Link from "next/link";
import { cn, formatDate, getInitials } from "@/lib/utils";

interface Client {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    stats: { logs: number; checkins: number };
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

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card">
                    <Users className="w-4 h-4 text-brand-400 mb-1" />
                    <p className="stat-value">{clients.length}</p>
                    <p className="stat-label">Active Clients</p>
                </div>
                <div className="stat-card">
                    <TrendingUp className="w-4 h-4 text-success mb-1" />
                    <p className="stat-value">{pendingCheckIns}</p>
                    <p className="stat-label">Pending Reviews</p>
                </div>
                <div className="stat-card">
                    <Activity className="w-4 h-4 text-warning mb-1" />
                    <p className="stat-value">{clients.reduce((acc, c) => acc + c.stats.logs, 0)}</p>
                    <p className="stat-label">Logs (Total)</p>
                </div>
                <div className="stat-card">
                    <Calendar className="w-4 h-4 text-brand-300 mb-1" />
                    <p className="stat-value">{clients.reduce((acc, c) => acc + c.stats.checkins, 0)}</p>
                    <p className="stat-label">Check-ins (Total)</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Client Roster */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="heading-3">My Stable</h3>
                        <Link href="/admin?tab=codes" className="btn-ghost btn-sm text-xs border-dashed">
                            Invite Client +
                        </Link>
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
                                    className="card p-5 group hover:border-brand-600/40 transition-all"
                                >
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-brand flex items-center justify-center text-sm font-bold text-white shadow-glow-sm">
                                            {c.avatarUrl ? <img src={c.avatarUrl} alt="avatar" /> : getInitials(c.name)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-fg group-hover:text-brand-400 transition-colors">{c.name}</p>
                                            <p className="text-xs text-fg-muted">{c.email}</p>
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
                                href="/checkins"
                                className={cn(
                                    "block card p-4 border transition-all",
                                    ci.status === "Pending" ? "border-brand-600/30 bg-brand-950/20" : "hover:border-surface-subtle"
                                )}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-brand-400 uppercase tracking-widest mb-1">Week {ci.week}</p>
                                        <p className="font-bold text-fg">{ci.clientName}</p>
                                    </div>
                                    {ci.status === "Pending" && (
                                        <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse shadow-glow-brand" />
                                    )}
                                </div>
                                <div className="mt-3 flex items-center justify-between text-[10px] text-fg-muted font-medium">
                                    <span>{formatDate(ci.date)}</span>
                                    <div className="flex items-center gap-1 group">
                                        Review <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
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
