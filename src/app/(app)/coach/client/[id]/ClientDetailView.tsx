"use client";

import { useState } from "react";
import {
    Users, Activity, Calendar, MessageSquare,
    MapPin, Info, Dumbbell, Award, Scale, MoreHorizontal, ChevronRight, CheckCircle2, Edit3, Zap, Settings,
    Trash2, AlertTriangle
} from "lucide-react";
import { useRouter } from "next/navigation";
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
    trainingLocation?: string | null;
    trainingDaysPerWeek?: number | null;
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
    const [assignMode, setAssignMode] = useState<"MENU" | "LIST" | "IMPORT">("MENU");
    const [updating, setUpdating] = useState(false);
    const [shareCode, setShareCode] = useState("");
    const [importing, setImporting] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [confirmEmail, setConfirmEmail] = useState("");
    const router = useRouter();

    const updatePlan = async (planId: string) => {
        setUpdating(true);
        try {
            const res = await fetch("/api/coach/clients/plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: client.id, planId }),
            });
            if (res.ok) {
                window.location.reload();
            } else {
                alert("Failed to update plan");
            }
        } catch (e) {
            alert("Network error.");
        } finally {
            setUpdating(false);
        }
    };

    const handleImport = async () => {
        if (!shareCode) return;
        setImporting(true);
        try {
            const res = await fetch("/api/plans/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: shareCode }),
            });
            if (res.ok) {
                const data = await res.json();
                
                await fetch("/api/coach/clients/plan", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clientId: client.id, planId: data.id }),
                });

                window.location.reload();
            } else {
                const data = await res.json();
                alert(data.error || "Import failed.");
            }
        } catch (e) {
            alert("Network error.");
        } finally {
            setImporting(false);
        }
    };

    const handleRemoveClient = async () => {
        if (confirmEmail.toLowerCase() !== client.email.toLowerCase()) {
            alert("Email mismatch. Operation aborted.");
            return;
        }

        setUpdating(true);
        try {
            const res = await fetch("/api/coach/clients/remove", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: client.id }),
            });
            if (res.ok) {
                router.push("/coach");
            } else {
                alert("Failed to remove client.");
            }
        } catch (e) {
            alert("Network error.");
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Client Profile Header */}
            <div className="card p-6 flex flex-col sm:flex-row items-center gap-6 justify-between text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-brand flex items-center justify-center text-xl font-bold text-white shadow-glow-brand shrink-0">
                        {client.avatarUrl ? <img src={client.avatarUrl} alt="avatar" className="w-full h-full object-cover rounded-3xl" /> : getInitials(client.name)}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-fg tracking-tight">{client.name || "Strength Athlete"}</h2>
                        <p className="text-sm text-fg-muted mb-1">{client.email}</p>
                        <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                            <span className="badge-brand text-[9px] uppercase font-bold tracking-widest">{client.role} Member</span>
                            {client.goal && <span className="badge text-[9px] bg-brand-500/10 text-brand-400 border border-brand-500/20">{client.goal.replace("_", " ")}</span>}
                            {client.experience && <span className="badge text-[9px] bg-warning-500/10 text-warning border border-warning-500/20">{client.experience.replace("_", " ")}</span>}
                            {client.trainingLocation && <span className="badge text-[9px] bg-success-500/10 text-success border border-success-500/20">{client.trainingLocation} Training</span>}
                            {client.trainingDaysPerWeek && <span className="badge text-[9px] bg-surface-muted text-fg-muted border border-surface-border">{client.trainingDaysPerWeek} Days / Wk</span>}
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Link href={`/chat?with=${client.id}`} className="btn-secondary px-6 h-11">
                        <MessageSquare className="w-4 h-4" /> Message
                    </Link>
                    <button className="btn-icon bg-surface-elevated w-11 h-11 rounded-xl">
                        <MoreHorizontal className="w-5 h-5 text-fg-muted" />
                    </button>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Active Plan & Progress */}
                <div className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="heading-3 px-2 flex items-center gap-2 uppercase tracking-widest text-[11px] font-black text-brand-400">
                            <Dumbbell className="w-4 h-4" />
                            Active Programme
                        </h3>
                        {client.activePlan ? (
                            <div className="card p-6 border-brand-800/20 bg-brand-950/10 shadow-glow-brand-sm">
                                <Link href={`/plans/create?id=${client.activePlan.id}&view=true`} className="group flex items-start justify-between cursor-pointer hover:bg-white/5 p-4 -m-4 rounded-xl transition-all mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-xl font-black text-fg">{client.activePlan.name}</h4>
                                            <ChevronRight className="w-4 h-4 text-brand-400 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                                        </div>
                                        <p className="text-sm text-fg-muted">Currently deployed to athlete. Click to view.</p>
                                    </div>
                                    <Award className="w-8 h-8 text-brand-400 opacity-40 shrink-0 group-hover:opacity-100 transition-opacity" />
                                </Link>

                                {assigning ? (
                                    <div className="mt-6 space-y-3 animate-fade-in bg-surface-muted/50 p-4 rounded-2xl border border-surface-border">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Select New Protocol</p>
                                        <div className="flex flex-col gap-2">
                                            {availablePlans.map((p) => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => updatePlan(p.id)}
                                                    disabled={updating}
                                                    className="flex items-center justify-between p-3 rounded-xl bg-surface hover:bg-surface-elevated border border-surface-border text-left group transition-all"
                                                >
                                                    <span className="text-sm font-bold text-fg group-hover:text-brand-400">{p.name}</span>
                                                    <span className="text-[8px] bg-brand-500/10 text-brand-400 px-1.5 py-0.5 rounded uppercase font-black">{p.type}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <button 
                                            onClick={() => setAssigning(false)}
                                            className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest hover:text-fg w-full text-center py-2"
                                        >
                                            Cancel Deployment
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                        <Link href={`/plans/create?id=${client.activePlan.id}&clientId=${client.id}`} className="btn-primary btn-sm flex-1 flex items-center justify-center gap-2 h-11 border border-brand-500/30">
                                            <Edit3 className="w-4 h-4" /> Edit Plan
                                        </Link>
                                        <button 
                                            onClick={() => setAssigning(true)}
                                            className="btn-secondary btn-sm flex-1 h-11 font-bold uppercase tracking-wide border border-surface-border hover:bg-surface-elevated"
                                        >
                                            Assign New
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="card p-8 text-center border-dashed bg-surface-muted/30">
                                {assigning ? (
                                    <div className="space-y-6 animate-fade-in text-left">
                                        {assignMode === "MENU" && (
                                            <>
                                                <div className="space-y-1 text-center mb-6">
                                                    <h4 className="text-sm font-black uppercase tracking-widest text-fg">Assign New Protocol</h4>
                                                    <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest leading-relaxed">Choose a strategic path for this athlete.</p>
                                                </div>
                                                <div className="grid gap-3">
                                                    <button 
                                                        onClick={() => setAssignMode("LIST")}
                                                        className="card-hover p-4 flex items-center justify-between border-brand-500/20 bg-brand-500/5 group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400">
                                                                <Calendar className="w-5 h-5" />
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="text-sm font-black text-fg uppercase tracking-tight group-hover:text-brand-400">Existing Programme</p>
                                                                <p className="text-[9px] text-fg-muted font-bold uppercase tracking-widest italic">From your saved database</p>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-fg-subtle" />
                                                    </button>

                                                    <Link 
                                                        href={`/plans/create?clientId=${client.id}`}
                                                        className="card-hover p-4 flex items-center justify-between border-warning/20 bg-warning/5 group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
                                                                <Dumbbell className="w-5 h-5" />
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="text-sm font-black text-fg uppercase tracking-tight group-hover:text-warning">Forge New Protocol</p>
                                                                <p className="text-[9px] text-fg-muted font-bold uppercase tracking-widest italic">Build from scratch for this client</p>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-fg-subtle" />
                                                    </Link>

                                                    <button 
                                                        onClick={() => setAssignMode("IMPORT")}
                                                        className="card-hover p-4 flex items-center justify-between border-success/20 bg-success/5 group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
                                                                <Zap className="w-5 h-5" />
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="text-sm font-black text-fg uppercase tracking-tight group-hover:text-success">Import via Code</p>
                                                                <p className="text-[9px] text-fg-muted font-bold uppercase tracking-widest italic">Deploy via protocol share key</p>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-fg-subtle" />
                                                    </button>
                                                </div>
                                                <button 
                                                    onClick={() => setAssigning(false)}
                                                    className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-fg-subtle hover:text-fg transition-all"
                                                >
                                                    Cancel Operations
                                                </button>
                                            </>
                                        )}

                                        {assignMode === "LIST" && (
                                            <div className="space-y-4">
                                                <button onClick={() => setAssignMode("MENU")} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-fg-muted hover:text-fg">
                                                    <ChevronRight className="w-3 h-3 rotate-180" /> Back
                                                </button>
                                                <div className="grid gap-2 max-h-[300px] overflow-y-auto no-scrollbar">
                                                    {availablePlans.length === 0 ? (
                                                        <p className="p-8 text-center text-[10px] font-bold uppercase tracking-widest text-fg-subtle italic">No protocols found in database.</p>
                                                    ) : availablePlans.map((p) => (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => updatePlan(p.id)}
                                                            className="flex items-center justify-between p-4 rounded-xl bg-surface-muted hover:bg-surface-elevated border border-surface-border transition-all group"
                                                        >
                                                            <span className="font-bold text-sm text-fg group-hover:text-brand-400">{p.name}</span>
                                                            <ChevronRight className="w-4 h-4" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {assignMode === "IMPORT" && (
                                            <div className="space-y-5">
                                                <button onClick={() => setAssignMode("MENU")} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-fg-muted hover:text-fg">
                                                    <ChevronRight className="w-3 h-3 rotate-180" /> Back
                                                </button>
                                                <div className="card p-6 bg-surface-card border-brand-500/20 shadow-glow-brand-sm">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 mb-2 block">Protocol Share Key</label>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text"
                                                            placeholder="E.G. ALPHA-99"
                                                            className="input flex-1 font-mono uppercase font-black tracking-widest"
                                                            value={shareCode}
                                                            onChange={(e) => setShareCode(e.target.value)}
                                                        />
                                                        <button 
                                                            onClick={handleImport}
                                                            disabled={importing || !shareCode}
                                                            className="btn-primary h-12 px-6 shadow-glow-brand"
                                                        >
                                                            {importing ? "..." : "Import"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-center mb-4">
                                            <div className="w-12 h-12 rounded-2xl bg-surface-muted flex items-center justify-center text-fg-subtle border border-surface-border">
                                                <Settings className="w-6 h-6 animate-spin-slow" />
                                            </div>
                                        </div>
                                        <p className="text-fg-muted text-[10px] font-black uppercase tracking-widest italic mb-6">No protocol currently deployed to athlete line.</p>
                                        <button onClick={() => { setAssigning(true); setAssignMode("MENU"); }} className="btn-primary px-10 h-12 shadow-glow-brand">Deploy New Plan</button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <h3 className="heading-3 px-2 flex items-center gap-2 uppercase tracking-widest text-[11px] font-black text-warning">
                            <Activity className="w-4 h-4" />
                            Recent Output
                        </h3>
                        <div className="space-y-2">
                            {logs.length === 0 ? (
                                <p className="text-sm text-fg-muted px-2 italic">Zero sessions logged in recent database cycles.</p>
                            ) : (
                                logs.map((l) => (
                                    <Link key={l.id} href={`/plans/log/view/${l.id}`} className="card p-4 flex items-center justify-between group hover:border-brand-500/40 transition-all cursor-pointer">
                                        <div>
                                            <h5 className="font-black text-fg text-sm tracking-tight group-hover:text-brand-400">{l.workoutName}</h5>
                                            <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest">{l.setCount} sets verified</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-fg-subtle font-black uppercase tracking-widest">{formatDate(l.date)}</p>
                                            <ChevronRight className="w-4 h-4 text-fg-subtle ml-auto mt-1 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Advanced Metrics Card */}
                    <div className="card p-6 border-brand-500/20 bg-gradient-brand/5 shadow-glow-brand-sm">
                        <div className="flex items-center gap-2 mb-6 text-brand-400">
                            <Zap className="w-4 h-4" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest italic">Performance Intelligence</h4>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Adherence</p>
                                <p className="text-2xl font-black text-fg leading-none italic">94<span className="text-brand-400">%</span></p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Logs</p>
                                <p className="text-2xl font-black text-fg leading-none italic">{logs.length}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Check-ins</p>
                                <p className="text-2xl font-black text-fg leading-none italic">100<span className="text-success">%</span></p>
                            </div>
                            <div className="space-y-1 text-right">
                                <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Trend</p>
                                <p className="text-2xl font-black text-brand-400 leading-none italic font-mono">↗</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Check-ins Sidebar */}
                <div className="space-y-4">
                    <h3 className="heading-3 px-2 flex items-center gap-2 uppercase tracking-widest text-[11px] font-black text-success">
                        <Calendar className="w-4 h-4" />
                        Accountability Log
                    </h3>
                    <div className="space-y-3">
                        {checkIns.length === 0 ? (
                            <div className="card p-12 text-center border-dashed opacity-50 flex flex-col items-center">
                                <Calendar className="w-8 h-8 text-fg-subtle mb-3" />
                                <p className="text-xs text-fg-muted font-black uppercase tracking-widest italic">No deployments found.</p>
                            </div>
                        ) : (
                            checkIns.map((ci) => (
                                <Link 
                                    href={`/coach/checkins/${ci.id}`}
                                    key={ci.id} 
                                    className={cn(
                                        "card-hover p-5 border transition-all flex items-center justify-between group",
                                        ci.status === "Pending" ? "border-brand-500/40 bg-brand-500/5 shadow-glow-brand-sm" : "hover:bg-surface-subtle"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all",
                                            ci.status === "Pending" ? "bg-brand-500/10 border-brand-500/30 text-brand-400" : "bg-surface-muted text-fg-subtle group-hover:border-brand-500/30"
                                        )}>
                                            <Scale className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-fg uppercase tracking-widest">Protocol Week {ci.week}</p>
                                            <p className="text-[10px] text-fg-subtle font-bold uppercase tracking-[0.1em] mt-0.5">{formatDate(ci.date)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {ci.status === "Pending" ? (
                                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500 text-white text-[9px] font-black uppercase tracking-widest shadow-glow-brand animate-pulse">Review</span>
                                        ) : (
                                            <span className="text-[9px] font-black uppercase tracking-widest text-success border border-success/30 px-3 py-1.5 rounded-xl">Clearance</span>
                                        )}
                                        <ChevronRight className="w-4 h-4 text-fg-subtle group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="border-t border-surface-border pt-12 mt-12">
                <div className="card p-6 border-danger-500/20 bg-danger-500/5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="space-y-1">
                            <h4 className="text-sm font-black text-danger uppercase tracking-widest flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Danger Zone
                            </h4>
                            <p className="text-xs text-fg-muted max-w-md mt-2">
                                Revoking this athlete&apos;s premium access will remove them from your stable and reset their status to Free. They will no longer see your assigned plans.
                            </p>
                        </div>

                        {!removing ? (
                            <button 
                                onClick={() => setRemoving(true)}
                                className="btn-secondary border-danger-500/30 text-danger hover:bg-danger-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest h-10 px-6"
                            >
                                Remove Client
                            </button>
                        ) : (
                            <div className="w-full sm:w-auto space-y-3 animate-fade-in">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Confirm Athlete Email To Proceed</label>
                                    <input 
                                        type="email"
                                        placeholder={client.email}
                                        className="input input-sm border-danger-500/30 font-mono text-xs"
                                        value={confirmEmail}
                                        onChange={(e) => setConfirmEmail(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleRemoveClient}
                                        disabled={updating || !confirmEmail}
                                        className="btn-primary bg-danger border-danger hover:bg-danger-600 shadow-glow-danger-sm flex-1 text-[10px] font-black uppercase tracking-widest h-10"
                                    >
                                        Authorize Removal
                                    </button>
                                    <button 
                                        onClick={() => { setRemoving(false); setConfirmEmail(""); }}
                                        className="btn-secondary flex-1 text-[10px] font-black uppercase tracking-widest h-10"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
