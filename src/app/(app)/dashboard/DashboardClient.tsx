"use client";

import { useState } from "react";
import Link from "next/link";
import { Dumbbell, ChevronRight, Clock, Flame, Plus, Activity, TrendingUp, Calendar, Ticket, Check } from "lucide-react";
import { formatRelative, cn } from "@/lib/utils";

interface Exercise {
    id: string;
    name: string;
    sets: number;
    reps: string;
    weightTargetKg?: number | null;
    muscleGroup?: string | null;
}

interface Workout {
    id: string;
    name: string;
    exercises: Exercise[];
    notes?: string | null;
}

interface RecentLog {
    id: string;
    workoutName: string;
    loggedAt: string;
}

interface Props {
    user: { name?: string | null; role: string };
    activePlan: { name: string } | null;
    todayWorkout: Workout | null;
    activeSession: { id: string; workoutId: string; workoutName: string } | null;
    recentLogs: RecentLog[];
}

export function DashboardClient({ user, activePlan, todayWorkout, activeSession, recentLogs }: Props) {
    const [code, setCode] = useState("");
    const [codeStatus, setCodeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [codeMsg, setCodeMsg] = useState("");

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return "Good morning";
        if (h < 18) return "Good afternoon";
        return "Good evening";
    };

    const redeemCode = async () => {
        setCodeStatus("loading");
        const res = await fetch("/api/codes/redeem", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (res.ok) {
            setCodeStatus("success");
            setCodeMsg("Access Granted!");
            setTimeout(() => window.location.reload(), 1000);
        } else {
            setCodeStatus("error");
            setCodeMsg(data.error ?? "Invalid code");
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Greeting */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-fg tracking-tight">
                        {greeting()}, {user.name?.split(" ")[0] ?? "Athlete"} 👋
                    </h2>
                    <p className="text-sm text-fg-muted mt-1 font-medium">
                        {activePlan ? `Active plan: ${activePlan.name}` : "No active plan — pick one to get started."}
                    </p>
                </div>

                {user.role === "FREE" && (
                    <div className="card p-4 bg-brand-500/5 border-brand-500/20 max-w-sm w-full animate-fade-in">
                        <div className="flex items-center gap-2 mb-3">
                            <Ticket className="w-3.5 h-3.5 text-brand-400" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400">Unlock Full Access</p>
                        </div>
                        <div className="flex gap-2">
                            <input
                                placeholder="ACCESS CODE"
                                className="input-sm flex-1 text-center font-mono font-bold uppercase tracking-widest text-xs h-9"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                maxLength={8}
                            />
                            <button 
                                onClick={redeemCode}
                                disabled={code.length < 6 || codeStatus === "loading"}
                                className="btn-primary btn-sm h-9 px-4"
                            >
                                {codeStatus === "loading" ? "..." : <Check className="w-4 h-4" />}
                            </button>
                        </div>
                        {codeMsg && (
                            <p className={cn(
                                "text-[9px] font-bold mt-2 uppercase tracking-wider text-center",
                                codeStatus === "success" ? "text-success" : "text-danger"
                            )}>
                                {codeMsg}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Active Session Prompt */}
            {activeSession && (
                <div className="card-hover p-4 bg-gradient-to-r from-brand-600/20 to-brand-950 border-brand-500/40 border shadow-glow-brand animate-pulse-slow">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand-400 flex items-center justify-center">
                                <Flame className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h4 className="font-bold text-fg">Active Session in Progress</h4>
                                <p className="text-sm text-brand-300">{activeSession.workoutName}</p>
                            </div>
                        </div>
                        <Link href={`/plans/log/${activeSession.workoutId}`} className="btn-primary shadow-glow-brand px-6">
                            Resume
                        </Link>
                    </div>
                </div>
            )}

            {/* Quick stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: "Streak", val: "—", icon: Flame, color: "text-warning" },
                    { label: "This Week", val: "0", icon: Activity, color: "text-brand-400" },
                    { label: "All Time", val: recentLogs.length.toString(), icon: TrendingUp, color: "text-success" },
                    { label: "Next Day", val: "Tomorrow", icon: Calendar, color: "text-brand-300" },
                ].map((s) => (
                    <div key={s.label} className="stat-card">
                        <s.icon className={`w-4 h-4 ${s.color} mb-1`} />
                        <p className="stat-value text-lg">{s.val}</p>
                        <p className="stat-label">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Today's Workout */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="heading-3">Today&apos;s Workout</h3>
                    {todayWorkout && (
                        <Link 
                            href={`/plans/log/${todayWorkout.id}`} 
                            className={cn(
                                "btn-primary btn-sm px-4",
                                activeSession?.workoutId === todayWorkout.id ? "shadow-glow-success bg-success border-success hover:bg-success-600" : "shadow-glow-brand"
                            )}
                        >
                            <Flame className={cn("w-3 h-3", activeSession?.workoutId === todayWorkout.id && "animate-pulse")} />
                            {activeSession?.workoutId === todayWorkout.id ? "Resume" : "Start"}
                        </Link>
                    )}
                </div>

                {todayWorkout ? (
                    <div className="card p-5">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h4 className="font-semibold text-lg text-fg">{todayWorkout.name}</h4>
                                <p className="text-sm text-fg-muted mt-0.5">
                                    {todayWorkout.exercises.length} exercises
                                    {todayWorkout.notes && ` · ${todayWorkout.notes}`}
                                </p>
                            </div>
                            <div className="badge-muted">
                                <Clock className="w-3 h-3" />
                                ~60 min
                            </div>
                        </div>

                        <div className="space-y-2">
                            {todayWorkout.exercises.slice(0, 5).map((ex) => (
                                <div
                                    key={ex.id}
                                    className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-surface-muted border border-surface-border"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-brand-950 flex items-center justify-center">
                                            <Dumbbell className="w-3.5 h-3.5 text-brand-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-fg">{ex.name}</p>
                                            {ex.muscleGroup && (
                                                <p className="text-xs text-fg-subtle">{ex.muscleGroup}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-fg">
                                            {ex.sets} × {ex.reps}
                                        </p>
                                        {ex.weightTargetKg && (
                                            <p className="text-xs text-fg-muted">{ex.weightTargetKg}kg</p>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {todayWorkout.exercises.length > 5 && (
                                <p className="text-xs text-fg-muted text-center pt-1">
                                    +{todayWorkout.exercises.length - 5} more exercises
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="card p-10 text-center space-y-4 bg-surface-muted/30 border-dashed">
                        <Dumbbell className="w-12 h-12 text-brand-400 mx-auto opacity-40" />
                        <div>
                            <p className="font-black text-lg text-fg uppercase tracking-tight">Protocol Unassigned</p>
                            <p className="text-sm text-fg-muted max-w-xs mx-auto mt-2">
                                {activePlan 
                                    ? "Today is a scheduled rest optimization day. Recover well." 
                                    : "You need an active training protocol to begin tracking metrics."}
                            </p>
                        </div>
                        <Link href="/plans" className="btn-primary shadow-glow-brand-sm mx-auto px-8 h-11 text-[10px] font-black uppercase tracking-widest">
                            {activePlan ? "View Exercises" : "Choose a Plan"}
                        </Link>
                    </div>
                )}
            </div>

            {/* Recent Activity */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="heading-3">Recent Sessions</h3>
                    <Link href="/progress" className="btn-ghost btn-sm text-brand-400">
                        View all
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                </div>

                {recentLogs.length > 0 ? (
                    <div className="card divide-y divide-surface-border">
                        {recentLogs.slice(0, 5).map((log) => (
                            <div key={log.id} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-success-muted flex items-center justify-center">
                                        <Activity className="w-3.5 h-3.5 text-success" />
                                    </div>
                                    <p className="text-sm font-medium text-fg">{log.workoutName}</p>
                                </div>
                                <p className="text-xs text-fg-muted">{formatRelative(log.loggedAt)}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="card p-6 text-center">
                        <p className="text-fg-muted text-sm">No sessions logged yet. Start your first workout!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
