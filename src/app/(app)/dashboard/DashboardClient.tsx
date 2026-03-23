"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Walkthrough } from "@/components/shared/Walkthrough";
import { Dumbbell, ChevronRight, Clock, Flame, Plus, Activity, TrendingUp, Calendar, Ticket, Check, Edit3 } from "lucide-react";
import { formatRelative, cn } from "@/lib/utils";
import { isCardio } from "@/components/shared/ExerciseAutocomplete";

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
    workoutId: string;
    workoutName: string;
    loggedAt: string;
}

interface Props {
    user: { name?: string | null; role: string };
    activePlan: { name: string } | null;
    todayWorkout: Workout | null;
    todayCompleted?: boolean;
    activeSession: { id: string; workoutId: string; workoutName: string } | null;
    recentLogs: RecentLog[];
    avgDurationMin?: number;
    weeklyMetrics?: {
        workoutsCompleted: number;
        totalMins: number;
    };
}

export function DashboardClient({ user, activePlan, todayWorkout, todayCompleted, activeSession, recentLogs, avgDurationMin, weeklyMetrics }: Props) {
    const router = useRouter();
    const [code, setCode] = useState("");
    const [codeStatus, setCodeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [codeMsg, setCodeMsg] = useState("");
    const [showTour, setShowTour] = useState(false);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("tour") === "true") {
            setShowTour(true);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const uncompleteLog = async (logId: string, workoutId: string) => {
        try {
            const res = await fetch(`/api/logs/${logId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "IN_PROGRESS" })
            });
            if (res.ok) {
                router.push(`/plans/log/${workoutId}`);
            }
        } catch (e) {
            console.error(e);
        }
    };

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
            // Refresh with tour flag
            setTimeout(() => {
                window.location.href = "/dashboard?tour=true";
            }, 1000);
        } else {
            setCodeStatus("error");
            setCodeMsg(data.error ?? "Invalid code");
        }
    };

    const tourSteps = [
        {
            targetId: "nav-dashboard",
            title: "Command Center",
            description: "Your daily overview. See your current plan, stats, and today's mission at a glance.",
            position: "right" as const
        },
        {
            targetId: "nav-plans",
            title: "Military Protocol",
            description: "Access your training programs. View every exercise, set, and rep assigned by your coach.",
            position: "right" as const
        },
        {
            targetId: "nav-calendar",
            title: "Operations Log",
            description: "A bird's eye view of your schedule. See what's coming up and what you've already crushed.",
            position: "right" as const
        },
        {
            targetId: "nav-progress",
            title: "Performance Intel",
            description: "Analyze your gains. Track body metrics and strength plateaus over time.",
            position: "right" as const
        },
        {
            targetId: "nav-check-ins",
            title: "Strategic Check-ins",
            description: "Submit your weekly check-ins and progress photos to your coach for feedback.",
            position: "right" as const
        },
        {
            targetId: "nav-chat",
            title: "Direct Comms",
            description: "Instant access to your coach. Ask questions or get form checks any time.",
            position: "right" as const
        },
        {
            targetId: "today-workout",
            title: "Execute Today",
            description: "Ready to work? Start your scheduled session right here from the dashboard.",
            position: "bottom" as const
        }
    ];

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {showTour && <Walkthrough steps={tourSteps} onComplete={() => setShowTour(false)} />}
            
            {/* Greeting */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-fg tracking-tight">
                        {greeting()}, {user.name?.split(" ")[0] ?? "Athlete"} 👋
                    </h2>
                    <div className="flex items-center gap-3 mt-1">
                        <p className="text-sm text-fg-muted font-medium">
                            {activePlan ? `Active plan: ${activePlan.name}` : "No active plan — pick one to get started."}
                        </p>
                        {avgDurationMin !== undefined && avgDurationMin > 0 && (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-muted border border-surface-border text-[10px] font-bold text-fg-subtle uppercase tracking-widest">
                                <Clock className="w-3 h-3 text-brand-400" />
                                Avg {avgDurationMin} min
                            </span>
                        )}
                    </div>
                </div>

                {user.role === "FREE" && (
                    <div id="unlock-card" className="card p-4 bg-brand-500/5 border-brand-500/20 max-w-sm w-full animate-fade-in">
                        <div className="flex items-center gap-2 mb-3">
                            <Ticket className="w-3.5 h-3.5 text-brand-400" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400">Unlock Full Access</p>
                        </div>
                        <div className="flex gap-2">
                            <input
                                placeholder="ACCESS CODE"
                                className="input-sm flex-1 text-center font-mono font-bold uppercase tracking-widest text-xs h-9 bg-white text-black placeholder:text-gray-400"
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

            {/* Weekly Metrics */}
            {weeklyMetrics && (
                <div id="weekly-metrics" className="grid grid-cols-2 gap-4">
                    <div className="card p-4 flex items-center justify-between bg-gradient-to-br from-surface-card to-brand-950/10">
                        <div>
                            <p className="text-[9px] font-black tracking-widest uppercase text-brand-400/80 mb-0.5">This Week</p>
                            <p className="text-2xl font-black text-fg leading-none">{weeklyMetrics.workoutsCompleted} <span className="text-sm font-semibold text-fg-muted">sessions</span></p>
                        </div>
                        <div className="hidden sm:flex w-10 h-10 rounded-xl bg-brand-500/10 items-center justify-center">
                            <Activity className="w-4 h-4 text-brand-400" />
                        </div>
                    </div>
                    <div className="card p-4 flex items-center justify-between bg-gradient-to-br from-surface-card to-brand-950/10">
                        <div>
                            <p className="text-[9px] font-black tracking-widest uppercase text-brand-400/80 mb-0.5">Time Logged</p>
                            <p className="text-2xl font-black text-fg leading-none">{weeklyMetrics.totalMins} <span className="text-sm font-semibold text-fg-muted">mins</span></p>
                        </div>
                        <div className="hidden sm:flex w-10 h-10 rounded-xl bg-brand-500/10 items-center justify-center">
                            <Clock className="w-4 h-4 text-brand-400" />
                        </div>
                    </div>
                </div>
            )}

            {/* Today's Workout */}
            <div id="today-workout">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="heading-3">Today&apos;s Workout</h3>
                    {(todayWorkout && !todayCompleted) && (
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

                {todayCompleted ? (
                    <div className="card p-10 text-center space-y-4 bg-success-950/20 border-success-500/30">
                        <Check className="w-12 h-12 text-success mx-auto opacity-80" />
                        <div>
                            <p className="font-black text-lg text-success uppercase tracking-tight">Session Completed</p>
                            <p className="text-sm text-fg-muted max-w-xs mx-auto mt-2">
                                Great job! You have crushed today&apos;s scheduled workout. Take some time to rest and recover.
                            </p>
                        </div>
                    </div>
                ) : todayWorkout ? (
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
                                            {isCardio(ex.name)
                                                ? `${ex.sets > 1 ? `${ex.sets} × ` : ""}${ex.reps} min`
                                                : `${ex.sets} × ${ex.reps}`}
                                        </p>
                                        {ex.weightTargetKg && (
                                            <p className="text-xs text-fg-muted">
                                                {isCardio(ex.name) ? `Lvl ${ex.weightTargetKg}` : `${ex.weightTargetKg}kg`}
                                            </p>
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
                            <p className="font-black text-lg text-fg uppercase tracking-tight">Plan Unassigned</p>
                            <p className="text-sm text-fg-muted max-w-xs mx-auto mt-2">
                                {activePlan 
                                    ? "Today is a scheduled rest optimization day. Recover well." 
                                    : "You need an active training plan to begin tracking metrics."}
                            </p>
                        </div>
                        <Link href="/plans" className="btn-primary shadow-glow-brand-sm mx-auto px-8 h-11 text-[10px] font-black uppercase tracking-widest">
                            {activePlan ? "View Exercises" : "Choose a Plan"}
                        </Link>
                    </div>
                )}
            </div>

            {/* Recent Activity */}
            <div id="recent-sessions">
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
                            <Link href={`/plans/log/view/${log.id}`} key={log.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-muted/30 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-success-muted flex items-center justify-center">
                                        <Activity className="w-3.5 h-3.5 text-success" />
                                    </div>
                                    <p className="text-sm font-medium text-fg">{log.workoutName}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="text-xs text-fg-muted">{formatRelative(log.loggedAt)}</p>
                                    <button 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            uncompleteLog(log.id, log.workoutId);
                                        }}
                                        className="btn-icon w-7 h-7 bg-surface-elevated hover:bg-brand-500 hover:text-white transition-all shadow-sm"
                                        title="Uncomplete and Edit"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <ChevronRight className="w-4 h-4 text-fg-subtle" />
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="card p-6 text-center">
                        <p className="text-fg-muted text-sm">No sessions logged yet. Start your first workout!</p>
                    </div>
                )}
            </div>

            {user.role === "FREE" && (
                <div className="card p-6 bg-brand-950/10 border-brand-500/10 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                    <div>
                        <h4 className="text-sm font-bold text-fg">Ready for more?</h4>
                        <p className="text-xs text-fg-muted">Reach out to your coach for an access code to unlock Premium insights, chat, and check-ins.</p>
                    </div>
                    <Link href="/settings" className="btn-secondary btn-sm shrink-0 font-bold uppercase tracking-wide text-[10px]">
                        Redeem Code
                    </Link>
                </div>
            )}
        </div>
    );
}
