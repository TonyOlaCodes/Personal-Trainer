"use client";

import { useMemo, useState } from "react";
import {
    Users, Activity, Calendar, MessageSquare,
    ChevronRight, TrendingUp, HelpCircle, CheckCircle2, Target
} from "lucide-react";
import Link from "next/link";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { WorkoutSessionModal } from "@/components/shared/WorkoutSessionModal";

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

interface ActivePlan {
    id: string;
    clientId: string;
    clientName: string;
    planId: string;
    planName: string;
    currentWeek: number;
}

interface RecentWorkoutNote {
    id: string;
    workoutLogId: string;
    text: string;
    createdAt: string;
    clientName: string;
    workoutName: string;
}

interface Props {
    clients: Client[];
    recentCheckIns: RecentCheckIn[];
    activePlans: ActivePlan[];
    recentWorkoutNotes: RecentWorkoutNote[];
}

export function CoachDashboardClient({ clients, recentCheckIns, activePlans, recentWorkoutNotes }: Props) {
    const [selectedClientId, setSelectedClientId] = useState("ALL");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const pendingCheckIns = recentCheckIns.filter(ci => ci.status === "Pending").length;
    const activeClients = clients.filter(c => !c.isDeleted);
    const deletedClients = clients.filter(c => c.isDeleted);

    const selectedClients = useMemo(() => {
        return selectedClientId === "ALL" ? activeClients : activeClients.filter(c => c.id === selectedClientId);
    }, [activeClients, selectedClientId]);

    const inDateRange = (date: string) => {
        const day = date.slice(0, 10);
        if (fromDate && day < fromDate) return false;
        if (toDate && day > toDate) return false;
        return true;
    };

    const filteredLogs = selectedClients.flatMap(client =>
        client.recentLogs.filter(log => inDateRange(log.date)).map(log => ({ ...log, clientName: client.name, clientId: client.id }))
    );
    const filteredCheckIns = selectedClients.flatMap(client =>
        client.recentCheckIns.filter(checkIn => inDateRange(checkIn.date)).map(checkIn => ({ ...checkIn, clientName: client.name, clientId: client.id }))
    );
    const selectedClient = selectedClientId === "ALL" ? selectedClients[0] : clients.find(c => c.id === selectedClientId);
    const chartClient = selectedClientId === "ALL" ? selectedClients.find(c => c.bodyweightHistory.length > 0) : selectedClient;
    const bodyweightData = (chartClient?.bodyweightHistory || [])
        .filter(row => inDateRange(row.date))
        .map(row => ({
            date: formatDate(row.date, { day: "numeric", month: "short" }),
            weight: row.weightKg,
        }));
    const currentWeight = chartClient?.currentWeightKg ?? bodyweightData.at(-1)?.weight ?? null;
    const targetWeight = chartClient?.targetWeightKg ?? null;
    const chartValues = [
        ...bodyweightData.map((row) => row.weight),
        ...(targetWeight ? [targetWeight] : []),
    ];
    const chartMin = chartValues.length > 0 ? Math.floor(Math.min(...chartValues) - 2) : 0;
    const chartMax = chartValues.length > 0 ? Math.ceil(Math.max(...chartValues) + 2) : 1;
    const chartRange = Math.max(chartMax - chartMin, 1);
    const chartWidth = 640;
    const chartHeight = 240;
    const chartPadding = { top: 20, right: 24, bottom: 34, left: 42 };
    const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
    const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
    const toX = (index: number) => chartPadding.left + (bodyweightData.length === 1 ? plotWidth / 2 : (index / (bodyweightData.length - 1)) * plotWidth);
    const toY = (weight: number) => chartPadding.top + ((chartMax - weight) / chartRange) * plotHeight;
    const chartPoints = bodyweightData.map((row, index) => ({ ...row, x: toX(index), y: toY(row.weight) }));
    const linePath = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    const areaPath = chartPoints.length > 0
        ? `${linePath} L ${chartPoints[chartPoints.length - 1].x.toFixed(1)} ${(chartPadding.top + plotHeight).toFixed(1)} L ${chartPoints[0].x.toFixed(1)} ${(chartPadding.top + plotHeight).toFixed(1)} Z`
        : "";
    const targetY = targetWeight ? toY(targetWeight) : null;

    return (
        <div className="space-y-8 animate-fade-in">
            <WorkoutSessionModal sessionId={selectedSessionId} onClose={() => setSelectedSessionId(null)} canAddCoachNote />
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

            <div className="grid lg:grid-cols-3 gap-4">
                <div className="card p-4 lg:col-span-1">
                    <label className="label text-[10px] uppercase tracking-widest">Client</label>
                    <select className="input h-11 text-sm" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                        <option value="ALL">All clients</option>
                        {activeClients.map(client => (
                            <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                    </select>
                </div>
                <div className="card p-4">
                    <label className="label text-[10px] uppercase tracking-widest">From</label>
                    <input type="date" className="input h-11 text-sm" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div className="card p-4">
                    <label className="label text-[10px] uppercase tracking-widest">To</label>
                    <input type="date" className="input h-11 text-sm" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="card p-5 lg:col-span-1">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="heading-3">Active Plans</h3>
                        <span className="badge-muted text-[10px]">{activePlans.length}</span>
                    </div>
                    <div className="space-y-2">
                        {activePlans.length === 0 ? (
                            <p className="text-sm text-fg-muted">No active client plans yet.</p>
                        ) : activePlans
                            .filter(plan => selectedClientId === "ALL" || plan.clientId === selectedClientId)
                            .map(plan => (
                                <Link key={plan.id} href={`/plans/create?id=${plan.planId}&view=true`} className="block rounded-xl border border-surface-border bg-surface-muted/30 p-3 hover:border-brand-500/40 transition-all">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">{plan.clientName}</p>
                                    <p className="text-sm font-bold text-fg mt-1">{plan.planName}</p>
                                    <p className="text-xs text-fg-muted mt-1">Current week {plan.currentWeek}</p>
                                </Link>
                            ))}
                    </div>
                </div>

                <div className="card p-5 lg:col-span-2">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                            <h3 className="heading-3">Bodyweight Goal Tracking</h3>
                            <p className="text-xs text-fg-muted mt-1">{chartClient ? chartClient.name : "Select a client with bodyweight logs"}</p>
                        </div>
                        {chartClient && (
                            <div className="text-right">
                                <p className="text-xl font-black text-fg">{currentWeight ? currentWeight.toFixed(1) : "--"}kg</p>
                                <p className="text-[10px] text-fg-subtle font-bold uppercase tracking-widest">
                                    Target {chartClient.targetWeightKg ? `${chartClient.targetWeightKg.toFixed(1)}kg` : "--"}
                                </p>
                            </div>
                        )}
                    </div>
                    {bodyweightData.length > 0 ? (
                        <div className="h-64 overflow-hidden">
                            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-full w-full" role="img" aria-label="Bodyweight trend chart">
                                <defs>
                                    <linearGradient id="coachBodyweightFill" x1="0" x2="0" y1="0" y2="1">
                                        <stop offset="5%" stopColor="#38bdf8" stopOpacity="0.35" />
                                        <stop offset="95%" stopColor="#38bdf8" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                {[0, 1, 2, 3].map((line) => {
                                    const y = chartPadding.top + (line / 3) * plotHeight;
                                    const value = chartMax - (line / 3) * chartRange;
                                    return (
                                        <g key={line}>
                                            <line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={y} y2={y} stroke="rgba(148,163,184,0.16)" strokeDasharray="4 4" />
                                            <text x={10} y={y + 4} fill="#94a3b8" fontSize="11" fontWeight="700">{value.toFixed(0)}</text>
                                        </g>
                                    );
                                })}
                                {targetY !== null && (
                                    <g>
                                        <line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={targetY} y2={targetY} stroke="#f87171" strokeDasharray="6 6" strokeWidth="2" />
                                        <text x={chartWidth - chartPadding.right - 54} y={Math.max(14, targetY - 7)} fill="#f87171" fontSize="11" fontWeight="800">Target</text>
                                    </g>
                                )}
                                <path d={areaPath} fill="url(#coachBodyweightFill)" />
                                <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                                {chartPoints.map((point) => (
                                    <g key={`${point.date}-${point.weight}`}>
                                        <circle cx={point.x} cy={point.y} r="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" />
                                        <title>{point.date}: {point.weight.toFixed(1)}kg</title>
                                    </g>
                                ))}
                                {chartPoints[0] && (
                                    <text x={chartPoints[0].x} y={chartHeight - 10} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700">{chartPoints[0].date}</text>
                                )}
                                {chartPoints.length > 1 && (
                                    <text x={chartPoints[chartPoints.length - 1].x} y={chartHeight - 10} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700">{chartPoints[chartPoints.length - 1].date}</text>
                                )}
                            </svg>
                        </div>
                    ) : (
                        <div className="h-64 rounded-2xl border border-dashed border-surface-border flex items-center justify-center text-sm text-fg-muted">
                            No bodyweight logs in this range.
                        </div>
                    )}
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Activity className="w-4 h-4 text-brand-400" />
                        <h3 className="heading-3">Filtered Output</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="stat-card"><p className="stat-value">{filteredLogs.length}</p><p className="stat-label">Workouts</p></div>
                        <div className="stat-card"><p className="stat-value">{filteredCheckIns.length}</p><p className="stat-label">Check-ins</p></div>
                    </div>
                    <div className="space-y-2">
                        {filteredLogs.slice(0, 6).map(log => (
                            <button key={log.id} onClick={() => setSelectedSessionId(log.id)} className="w-full text-left rounded-xl border border-surface-border bg-surface-muted/30 p-3 hover:border-brand-500/40 transition-all">
                                <p className="text-sm font-bold text-fg">{log.workoutName}</p>
                                <p className="text-xs text-fg-muted">{log.clientName} - {formatDate(log.date)}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Target className="w-4 h-4 text-success" />
                        <h3 className="heading-3">Goals</h3>
                    </div>
                    <div className="space-y-3">
                        {selectedClients.map(client => (
                            <div key={client.id} className="rounded-xl border border-surface-border bg-surface-muted/30 p-3">
                                <p className="text-sm font-bold text-fg">{client.name}</p>
                                <p className="text-xs text-fg-muted mt-1">{client.goal ? client.goal.replace("_", " ") : "No goal set"}</p>
                                <p className="text-[10px] text-fg-subtle font-bold uppercase tracking-widest mt-2">
                                    {client.currentWeightKg ? `${client.currentWeightKg.toFixed(1)}kg` : "--"} current / {client.targetWeightKg ? `${client.targetWeightKg.toFixed(1)}kg` : "--"} target
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <MessageSquare className="w-4 h-4 text-warning" />
                        <h3 className="heading-3">Workout Notes</h3>
                    </div>
                    <div className="space-y-2">
                        {recentWorkoutNotes.length === 0 ? (
                            <p className="text-sm text-fg-muted">No coach notes yet.</p>
                        ) : recentWorkoutNotes.map(note => (
                            <button key={note.id} onClick={() => setSelectedSessionId(note.workoutLogId)} className="w-full text-left rounded-xl border border-surface-border bg-surface-muted/30 p-3 hover:border-brand-500/40 transition-all">
                                <p className="text-xs font-black text-brand-400 uppercase tracking-widest">{note.clientName}</p>
                                <p className="text-sm font-bold text-fg mt-1">{note.workoutName}</p>
                                <p className="text-xs text-fg-muted mt-1 line-clamp-2">{note.text}</p>
                            </button>
                        ))}
                    </div>
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
                                            "w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white shadow-glow-sm",
                                            c.isDeleted ? "bg-surface-muted text-fg-subtle" : "bg-gradient-brand"
                                        )}>
                                            {c.avatarUrl ? <img src={c.avatarUrl} alt="avatar" /> : getInitials(c.name)}
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
                                href={`/coach/checkins/${ci.id}`}
                                className={cn(
                                    "block card p-4 border transition-all",
                                    ci.status === "Pending" ? "border-brand-600/30 bg-brand-500/5 shadow-glow-brand-sm" : "hover:bg-surface-muted/30"
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Protocol Week {ci.week}</span>
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
