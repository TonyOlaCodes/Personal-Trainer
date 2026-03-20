"use client";

import { useState } from "react";
import {
    Users, Activity, Calendar, MessageSquare,
    MapPin, Info, Dumbbell, Award, Scale, MoreHorizontal, ChevronRight, CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { cn, formatDate, getInitials } from "@/lib/utils";

interface Client {
    id: string;
    name?: string | null;
    email: string;
    role: string;
    avatarUrl?: string | null;
    activePlan: { id: string; name: string } | null;
    experience?: string | null;
    goal?: string | null;
}

interface ClientLog {
    id: string;
    workoutName: string;
    date: string;
    setCount: number;
}

interface ClientCheckIn {
    id: string;
    week: number;
    date: string;
    status: string;
}

interface Props {
    client: Client;
    availablePlans: { id: string; name: string; type: string }[];
    logs: ClientLog[];
    checkIns: ClientCheckIn[];
}

export function ClientDetailView({ client, availablePlans, logs, checkIns }: Props) {
    const [assigning, setAssigning] = useState(false);
    const [updating, setUpdating] = useState(false);

    const updatePlan = async (planId: string) => {
        setUpdating(true);
        const res = await fetch("/api/coach/clients/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId: client.id, planId }),
        });
        if (res.ok) {
            window.location.reload();
        } else {
            alert("Failed to update plan");
            setUpdating(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Client Profile Header */}
            <div className="card p-6 flex flex-col sm:flex-row items-center gap-6 justify-between">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-brand flex items-center justify-center text-xl font-bold text-white shadow-glow-brand">
                        {client.avatarUrl ? <img src={client.avatarUrl} alt="avatar" /> : getInitials(client.name)}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-fg">{client.name || "Strength Athlete"}</h2>
                        <p className="text-sm text-fg-muted mb-3">{client.email}</p>
                        <div className="flex flex-wrap gap-2">
                            <span className="badge-brand text-[10px] uppercase font-bold tracking-widest">{client.role}</span>
                            {client.goal && <span className="badge-muted text-[10px]">{client.goal.replace("_", " ")}</span>}
                            {client.experience && <span className="badge-muted text-[10px]">{client.experience.replace("_", " ")}</span>}
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Link href={`/chat?with=${client.id}`} className="btn-secondary px-6">
                        <MessageSquare className="w-4 h-4" /> Message
                    </Link>
                    <button className="btn-icon bg-surface-elevated">
                        <MoreHorizontal className="w-5 h-5 text-fg-muted" />
                    </button>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Active Plan & Progress */}
                <div className="space-y-4">
                    <h3 className="heading-3 px-2 flex items-center gap-2">
                        <Dumbbell className="w-4 h-4 text-brand-400" />
                        Active Programme
                    </h3>
                    {client.activePlan ? (
                        <div className="card p-6 border-brand-800/20 bg-brand-950/10">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h4 className="text-xl font-bold text-fg mb-1">{client.activePlan.name}</h4>
                                    <p className="text-sm text-fg-muted">Client is currently following this plan.</p>
                                </div>
                                <Award className="w-8 h-8 text-brand-400 opacity-40" />
                            </div>

                            {assigning ? (
                                <div className="mt-6 space-y-3 animate-fade-in bg-surface-muted/50 p-4 rounded-xl border border-surface-border">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Select New Protocol</p>
                                    <div className="flex flex-col gap-2">
                                        {availablePlans.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => updatePlan(p.id)}
                                                disabled={updating}
                                                className="flex items-center justify-between p-3 rounded-lg bg-surface hover:bg-surface-elevated border border-surface-border text-left group transition-all"
                                            >
                                                <span className="text-sm font-bold text-fg group-hover:text-brand-400">{p.name}</span>
                                                <span className="text-[8px] bg-surface-muted px-1.5 py-0.5 rounded uppercase font-black tracking-tighter">{p.type}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <button 
                                        onClick={() => setAssigning(false)}
                                        className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest hover:text-fg w-full text-center py-2"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="mt-8 flex gap-3">
                                    <Link href={`/plans/${client.activePlan.id}`} className="btn-primary btn-sm flex-1">
                                        View Detail
                                    </Link>
                                    <button 
                                        onClick={() => setAssigning(true)}
                                        className="btn-secondary btn-sm flex-1"
                                    >
                                        Assign New
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="card p-8 text-center border-dashed">
                            <p className="text-fg-muted text-sm mb-4">Client has no active plan assigned.</p>
                            {assigning ? (
                                <div className="space-y-3 animate-fade-in bg-surface-muted/50 p-4 rounded-xl border border-surface-border text-left">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Select New Protocol</p>
                                    <div className="flex flex-col gap-2">
                                        {availablePlans.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => updatePlan(p.id)}
                                                disabled={updating}
                                                className="flex items-center justify-between p-3 rounded-lg bg-surface hover:bg-surface-elevated border border-surface-border text-left group transition-all"
                                            >
                                                <span className="text-sm font-bold text-fg group-hover:text-brand-400">{p.name}</span>
                                                <span className="text-[8px] bg-surface-muted px-1.5 py-0.5 rounded uppercase font-black tracking-tighter">{p.type}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <button 
                                        onClick={() => setAssigning(false)}
                                        className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest hover:text-fg w-full text-center py-2"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button onClick={() => setAssigning(true)} className="btn-primary mx-auto">Assign Plan</button>
                            )}
                        </div>
                    )}

                    <h3 className="heading-3 px-2 pt-4 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-warning" />
                        Recent Sessions
                    </h3>
                    <div className="space-y-2">
                        {logs.length === 0 ? (
                            <p className="text-sm text-fg-muted px-2">No logs found.</p>
                        ) : (
                            logs.map((l) => (
                                <div key={l.id} className="card p-4 flex items-center justify-between group hover:border-surface-subtle transition-all">
                                    <div>
                                        <h5 className="font-bold text-fg text-sm">{l.workoutName}</h5>
                                        <p className="text-xs text-fg-muted">{l.setCount} sets logged</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-fg-muted">{formatDate(l.date)}</p>
                                        <ChevronRight className="w-4 h-4 text-fg-subtle ml-auto mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Check-ins Sidebar */}
                <div className="space-y-4">
                    <h3 className="heading-3 px-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-success" />
                        Check-in History
                    </h3>
                    <div className="space-y-4">
                        {checkIns.length === 0 ? (
                            <p className="text-sm text-fg-muted px-2">No check-ins found.</p>
                        ) : (
                            checkIns.map((ci) => (
                                <div key={ci.id} className={cn(
                                    "card p-5 border transition-all",
                                    ci.status === "Pending" ? "border-brand-600/30 bg-brand-950/20 shadow-glow-sm" : ""
                                )}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <p className="text-xs font-bold text-brand-400 uppercase tracking-widest">Week {ci.week}</p>
                                            <p className="text-xs text-fg-muted mt-0.5">{formatDate(ci.date)}</p>
                                        </div>
                                        {ci.status === "Responded"
                                            ? <CheckCircle2 className="w-5 h-5 text-success" />
                                            : <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse shadow-glow-brand" />
                                        }
                                    </div>
                                    <button className={cn(
                                        "w-full h-10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                        ci.status === "Pending" ? "btn-primary" : "btn-secondary"
                                    )}>
                                        {ci.status === "Pending" ? "Review Now" : "View Feedback"}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Quick Metrics (Static Placeholder for demo aesthetics) */}
                    <div className="card p-6 bg-surface-muted/30 space-y-4">
                        <h4 className="text-xs font-bold uppercase text-fg-subtle tracking-widest mb-2 flex items-center gap-2">
                            <Scale className="w-3 h-3" />
                            Client Trends
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-surface-elevated rounded-xl border border-surface-border">
                                <p className="text-[10px] text-fg-muted mb-1">Consistency (8w)</p>
                                <p className="text-lg font-bold text-success">92%</p>
                            </div>
                            <div className="p-3 bg-surface-elevated rounded-xl border border-surface-border">
                                <p className="text-[10px] text-fg-muted mb-1">Weekly PRs</p>
                                <p className="text-lg font-bold text-brand-400">4</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
