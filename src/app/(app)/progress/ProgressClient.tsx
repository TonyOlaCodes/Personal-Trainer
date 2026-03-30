"use client";

import { useState, useEffect, useMemo } from "react";
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ReferenceLine
} from "recharts";
import {
    TrendingUp, TrendingDown, Loader2,
    Dumbbell, Activity, Search, ChevronRight,
    Scale, Zap, Trophy, BarChart2,
    Flame, ArrowUpRight, ArrowDownRight, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumLockScreen } from "@/components/shared/PremiumLockScreen";
import Link from "next/link";

interface Props {
    userRole: string;
}

export function ProgressClient({ userRole }: Props) {
    const isPremium = ["PREMIUM", "COACH", "SUPER_ADMIN"].includes(userRole);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedExercise, setSelectedExercise] = useState<string>("");
    const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
    const [bwDays, setBwDays] = useState<7 | 30 | 90>(30);
    const [showExerciseModal, setShowExerciseModal] = useState(false);
    const [sbdDays, setSbdDays] = useState<30 | 90 | 365>(90);
    const [volTimeframe, setVolTimeframe] = useState<"daily" | "weekly" | "monthly" | "yearly">("weekly");

    useEffect(() => {
        if (!isPremium) { setLoading(false); return; }
        fetch("/api/stats")
            .then(res => res.json())
            .then(d => {
                setData(d);
                const exercises = Object.keys(d.exerciseHistory);
                if (exercises.length > 0) setSelectedExercise(exercises[0]);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [isPremium]);

    const getRegex = (q: string) => {
        try {
            return new RegExp(q.trim().split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*'), 'i');
        } catch { return new RegExp(q, 'i'); }
    };

    const exerciseList = useMemo(() => {
        if (!data) return [];
        const names = Object.keys(data.exerciseHistory);
        return names.filter(ex => exerciseSearchQuery ? getRegex(exerciseSearchQuery).test(ex) : true);
    }, [data, exerciseSearchQuery]);

    if (!isPremium) {
        return (
            <div className="p-4 sm:p-10">
                <PremiumLockScreen
                    title="Elite Progress Analytics"
                    description="Advanced progress tracking is available to Premium members. Upgrade to get professional strength analysis, PR tracking, and historical session breakdowns."
                />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
                <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
                <p className="text-fg-muted animate-pulse font-medium">Analyzing your evolution...</p>
            </div>
        );
    }

    if (!data || data.totalWorkouts === 0) {
        return (
            <div className="p-12 text-center card max-w-2xl mx-auto mt-12 bg-surface-muted/30">
                <Dumbbell className="w-12 h-12 text-brand-400/40 mx-auto mb-4" />
                <h3 className="heading-3 mb-2">Build Your First Data Point</h3>
                <p className="text-sm text-fg-muted mb-6">Complete a workout to see your progress come to life.</p>
                <Link href="/dashboard" className="btn-primary mx-auto">Start Today&apos;s Workout</Link>
            </div>
        );
    }

    const bodyweightData = data.bodyweight.history.slice(-bwDays).map((d: any) => ({
        ...d,
        target: data.bodyweight.target
    }));

    const consistencyPct = data.consistency.target > 0
        ? Math.min(Math.round((data.consistency.thisWeek / data.consistency.target) * 100), 100) : 0;

    const volumeChangeDir = (data.weeklySummary?.volumeChange || 0) >= 0;

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in mb-24 lg:mb-12">

            {/* ── WEEKLY PULSE ── */}
            <section>
                <h2 className="text-xs font-black text-fg-subtle uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-brand-400" />
                    Weekly Pulse
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {/* Consistency Ring */}
                    <div className="card p-5 flex items-center gap-4">
                        <div className="relative w-14 h-14 shrink-0">
                            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                <path
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none" stroke="#1E293B" strokeWidth="3"
                                />
                                <path
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none" stroke={consistencyPct >= 100 ? "#10B981" : "#8B5CF6"} strokeWidth="3"
                                    strokeDasharray={`${consistencyPct}, 100`}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-black text-fg">{data.consistency.thisWeek}/{data.consistency.target}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest">Workouts</p>
                            <p className="text-xs text-fg-muted mt-0.5">
                                {consistencyPct >= 100 ? "On track! 🔥" : `${data.consistency.target - data.consistency.thisWeek} to go`}
                            </p>
                        </div>
                    </div>

                    {/* Volume This Week */}
                    <div className="card p-5">
                        <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1">Volume</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-fg">
                                {data.weeklySummary?.totalVolume ? data.weeklySummary.totalVolume.toLocaleString() : "0"}
                            </span>
                            <span className="text-[10px] font-bold text-fg-muted">kg</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                            {volumeChangeDir ?
                                <ArrowUpRight className="w-3 h-3 text-success" /> :
                                <ArrowDownRight className="w-3 h-3 text-danger" />
                            }
                            <span className={cn("text-[10px] font-bold", volumeChangeDir ? "text-success" : "text-danger")}>
                                {data.weeklySummary?.volumeChange > 0 ? "+" : ""}{data.weeklySummary?.volumeChange || 0}% vs last week
                            </span>
                        </div>
                    </div>

                    {/* Weight */}
                    <div className="card p-5">
                        <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1">Bodyweight</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-fg">{data.bodyweight.current || "--"}</span>
                            <span className="text-[10px] font-bold text-fg-muted">kg</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                            {data.bodyweight.changeWeek >= 0 ?
                                <TrendingUp className="w-3 h-3 text-fg-muted" /> :
                                <TrendingDown className="w-3 h-3 text-fg-muted" />
                            }
                            <span className="text-[10px] font-bold text-fg-muted">
                                {data.bodyweight.changeWeek > 0 ? "+" : ""}{data.bodyweight.changeWeek.toFixed(1)}kg this week
                            </span>
                        </div>
                    </div>

                    {/* Total Workouts */}
                    <div className="card p-5">
                        <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1">Total Logged</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black text-fg">{data.totalWorkouts}</span>
                            <Trophy className="w-4 h-4 text-warning" />
                        </div>
                        <p className="text-[10px] text-fg-subtle font-bold mt-1.5 uppercase tracking-tight">Sessions completed</p>
                    </div>
                </div>
            </section>

            {/* ── LAST WORKOUT ── */}
            {data.lastWorkout && (
                <section className="card p-5 sm:p-6 bg-gradient-to-br from-brand-500/5 to-transparent border-brand-500/10">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                                <Dumbbell className="w-5 h-5 text-brand-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-fg">{data.lastWorkout.name}</h3>
                                <p className="text-[10px] font-bold text-fg-muted uppercase tracking-widest">{data.lastWorkout.date}</p>
                            </div>
                        </div>
                        {data.lastWorkout.feeling && (
                            <div className="text-lg">{["😵", "😓", "😐", "💪", "🔥"][data.lastWorkout.feeling - 1]}</div>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-surface-muted/50 rounded-xl p-3 text-center">
                            <p className="text-lg font-black text-fg">{data.lastWorkout.totalSets}</p>
                            <p className="text-[9px] font-bold text-fg-subtle uppercase tracking-widest">Sets</p>
                        </div>
                        <div className="bg-surface-muted/50 rounded-xl p-3 text-center">
                            <p className="text-lg font-black text-fg">
                                {data.lastWorkout.totalVolume.toLocaleString()}
                                <span className="text-[10px] text-fg-muted ml-0.5">kg</span>
                            </p>
                            <p className="text-[9px] font-bold text-fg-subtle uppercase tracking-widest">Volume</p>
                        </div>
                        <div className="bg-surface-muted/50 rounded-xl p-3 text-center">
                            <p className="text-lg font-black text-fg">{data.lastWorkout.duration || "--"}</p>
                            <p className="text-[9px] font-bold text-fg-subtle uppercase tracking-widest">Mins</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {data.lastWorkout.exercises.map((ex: string) => (
                            <span key={ex} className="px-2.5 py-1 bg-surface-muted/60 rounded-lg text-[10px] font-bold text-fg-muted uppercase tracking-wider">
                                {ex}
                            </span>
                        ))}
                    </div>
                </section>
            )}

            {/* ── BODYWEIGHT TREND ── */}
            {bodyweightData.length > 1 && (
                <section className="card p-5 sm:p-6 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <Scale className="w-5 h-5 text-brand-400" />
                            <div>
                                <h3 className="text-sm font-black text-fg uppercase tracking-widest">Bodyweight Trend</h3>
                                {data.bodyweight.target && (
                                    <p className="text-[10px] text-fg-muted mt-0.5">
                                        Target: <span className="text-brand-400 font-bold">{data.bodyweight.target}kg</span>
                                        {" · "}
                                        <span className={cn("font-bold", Math.abs(data.bodyweight.current - data.bodyweight.target) < 2 ? "text-success" : "text-fg-muted")}>
                                            {Math.abs(data.bodyweight.current - data.bodyweight.target).toFixed(1)}kg away
                                        </span>
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex bg-surface-muted p-1 rounded-xl self-start sm:self-auto">
                            {[7, 30, 90].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setBwDays(d as any)}
                                    className={cn(
                                        "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                        bwDays === d ? "bg-surface-card text-brand-400 shadow-sm" : "text-fg-subtle hover:text-fg"
                                    )}
                                >
                                    {d}D
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Weight Change Summary Bar */}
                    <div className="flex items-center gap-6 mb-6 px-2">
                        <div>
                            <p className="text-[9px] font-black text-fg-subtle uppercase tracking-widest">Week Change</p>
                            <p className={cn("text-sm font-black", data.bodyweight.changeWeek >= 0 ? "text-fg" : "text-success")}>
                                {data.bodyweight.changeWeek > 0 ? "+" : ""}{data.bodyweight.changeWeek.toFixed(1)} kg
                            </p>
                        </div>
                        <div className="w-px h-8 bg-surface-border" />
                        <div>
                            <p className="text-[9px] font-black text-fg-subtle uppercase tracking-widest">Total Change</p>
                            <p className={cn("text-sm font-black", data.bodyweight.totalChange < 0 ? "text-success" : "text-fg")}>
                                {data.bodyweight.totalChange > 0 ? "+" : ""}{data.bodyweight.totalChange.toFixed(1)} kg
                            </p>
                        </div>
                    </div>

                    <div className="h-[260px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={bodyweightData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                                <XAxis dataKey="date" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis 
                                    stroke="#4B5563" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    domain={[
                                        (min: number) => data.bodyweight.target ? Math.min(min, data.bodyweight.target) - 2 : min - 2,
                                        (max: number) => data.bodyweight.target ? Math.max(max, data.bodyweight.target) + 2 : max + 2
                                    ]} 
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#0F172A", borderRadius: "12px", border: "1px solid #1E293B", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}
                                    itemStyle={{ fontWeight: 800 }}
                                    labelStyle={{ color: "#6B7280", fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}
                                />
                                {data.bodyweight.target && (
                                    <ReferenceLine
                                        y={data.bodyweight.target}
                                        stroke="#10B981"
                                        strokeDasharray="4 4"
                                        strokeWidth={1.5}
                                        label={{ 
                                            value: `GOAL: ${data.bodyweight.target}kg`, 
                                            position: "right", 
                                            fill: "#10B981", 
                                            fontSize: 9, 
                                            fontWeight: 900,
                                            offset: 10
                                        }}
                                    />
                                )}
                                <Area type="monotone" dataKey="weight" name="Weight" stroke="#8B5CF6" strokeWidth={3} fill="url(#bwGrad)" dot={{ r: 3, fill: "#8B5CF6", strokeWidth: 0 }} activeDot={{ r: 6, fill: "#A78BFA", strokeWidth: 0 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </section>
            )}

            {/* ── SBD COMBINED CHART ── */}
            {data.sbdTimeline && data.sbdTimeline.length > 1 && (
                <section className="card p-5 sm:p-6 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <Zap className="w-5 h-5 text-warning" />
                                <h3 className="text-sm font-black text-fg uppercase tracking-widest">Squat · Bench · Deadlift</h3>
                            </div>
                            <p className="text-[10px] text-fg-muted ml-8">Estimated 1RM progression over time</p>
                        </div>
                        <div className="flex bg-surface-muted p-1 rounded-xl self-start shrink-0">
                            {([30, 90, 365] as const).map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setSbdDays(d)}
                                    className={cn(
                                        "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                        sbdDays === d ? "bg-surface-card text-brand-400 shadow-sm" : "text-fg-subtle hover:text-fg"
                                    )}
                                >
                                    {d === 365 ? "1Y" : `${d}D`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Lift summary pills */}
                    <div className="flex flex-wrap gap-3 mb-5">
                        {[
                            { label: "S", key: "squat",    color: "#EF4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)" },
                            { label: "B", key: "bench",    color: "#3B82F6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.2)" },
                            { label: "D", key: "deadlift", color: "#22C55E", bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.2)" },
                        ].map(({ label, key, color, bg, border }) => {
                            const latest = [...data.sbdTimeline].reverse().find((r: any) => r[key] !== null);
                            const earliest = data.sbdTimeline.find((r: any) => r[key] !== null);
                            const gain = latest && earliest ? (latest[key] - earliest[key]) : 0;
                            return (
                                <div key={key} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: bg, border: `1px solid ${border}` }}>
                                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>{label}</span>
                                    <div>
                                        <p className="text-sm font-black text-fg">
                                            {latest?.[key] ?? "--"}<span className="text-[10px] text-fg-muted ml-0.5">kg</span>
                                        </p>
                                        <p className="text-[9px] font-bold" style={{ color: gain >= 0 ? color : "#EF4444" }}>
                                            {gain > 0 ? `+${gain}` : gain < 0 ? `${gain}` : "--"}kg total
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={data.sbdTimeline.slice(-sbdDays)}
                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                                <XAxis dataKey="date" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#0F172A", borderRadius: "12px", border: "1px solid #1E293B", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}
                                    labelStyle={{ color: "#6B7280", fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}
                                    formatter={(value: any, name: any) => [
                                        `${value}kg`,
                                        name === "squat" ? "Squat" : name === "bench" ? "Bench" : "Deadlift"
                                    ]}
                                />
                                <Line
                                    type="monotone" dataKey="squat" name="squat"
                                    stroke="#EF4444" strokeWidth={2.5} dot={false}
                                    activeDot={{ r: 5, fill: "#EF4444", strokeWidth: 0 }}
                                    connectNulls animationDuration={800}
                                />
                                <Line
                                    type="monotone" dataKey="bench" name="bench"
                                    stroke="#3B82F6" strokeWidth={2.5} dot={false}
                                    activeDot={{ r: 5, fill: "#3B82F6", strokeWidth: 0 }}
                                    connectNulls animationDuration={800}
                                />
                                <Line
                                    type="monotone" dataKey="deadlift" name="deadlift"
                                    stroke="#22C55E" strokeWidth={2.5} dot={false}
                                    activeDot={{ r: 5, fill: "#22C55E", strokeWidth: 0 }}
                                    connectNulls animationDuration={800}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-center gap-6 mt-4">
                        {[
                            { label: "Squat",    color: "#EF4444" },
                            { label: "Bench",    color: "#3B82F6" },
                            { label: "Deadlift", color: "#22C55E" },
                        ].map(({ label, color }) => (
                            <div key={label} className="flex items-center gap-2">
                                <span className="w-6 h-0.5 inline-block rounded-full" style={{ backgroundColor: color }} />
                                <span className="text-[10px] font-bold text-fg-subtle uppercase tracking-wider">{label}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── STRENGTH EVOLUTION ── */}
            <section>
                <h2 className="text-xs font-black text-fg-subtle uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-warning" />
                    Strength Evolution
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(data.topExercises.length > 0 ? data.topExercises.slice(0, 3) : ["Bench Press", "Squat", "Deadlift"]).map((lift: string) => {
                        const big3Stats = data.big3[lift];
                        const historyKey = Object.keys(data.exerciseHistory).find(k => k.toLowerCase() === lift.toLowerCase()) || lift;
                        const history = data.exerciseHistory[historyKey] || [];
                        const progressData = history.map((h: any) => ({
                            date: h.date,
                            e1rm: Math.round(h.weight * (1 + h.reps / 30)),
                            weight: h.weight
                        }));
                        const latestWeight = history[history.length - 1]?.weight || big3Stats?.weight || 0;
                        const latestReps = history[history.length - 1]?.reps || big3Stats?.reps || 0;
                        const firstE1RM = progressData[0]?.e1rm || 0;
                        const latestE1RM = progressData[progressData.length - 1]?.e1rm || big3Stats?.oneRM || 0;
                        const gain = firstE1RM > 0 ? latestE1RM - firstE1RM : 0;

                        return (
                            <div
                                key={lift}
                                className="card p-5 hover:border-brand-500/20 transition-all cursor-pointer group"
                                onClick={() => { setSelectedExercise(historyKey); setShowExerciseModal(true); }}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest">{lift}</p>
                                        <h4 className="text-2xl font-black text-fg tracking-tighter mt-1">
                                            {latestE1RM || "--"}
                                            <span className="text-xs text-fg-muted ml-1 font-bold">kg e1RM</span>
                                        </h4>
                                    </div>
                                    {gain > 0 && (
                                        <div className="bg-success/10 text-success text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3" />
                                            +{gain}kg
                                        </div>
                                    )}
                                </div>

                                {progressData.length > 1 && (
                                    <div className="h-16 w-full mb-3">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={progressData}>
                                                <Line type="monotone" dataKey="e1rm" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                <p className="text-[10px] font-bold text-fg-muted uppercase tracking-tight">
                                    Last: {latestWeight}kg × {latestReps}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── PR TRACKER & VOLUME ── */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* PR Tracker */}
                <div className="card p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Trophy className="w-5 h-5 text-warning" />
                            <h3 className="text-sm font-black text-fg uppercase tracking-widest">Personal Records</h3>
                        </div>
                        <span className="text-[10px] font-bold text-fg-subtle uppercase">{data.prList.length} PRs</span>
                    </div>
                    <div className="space-y-2 max-h-[320px] overflow-y-auto no-scrollbar">
                        {data.prList.length === 0 ? (
                            <p className="text-sm text-fg-subtle text-center py-8">Log heavier sets to earn PRs!</p>
                        ) : (
                            data.prList.map((pr: any, i: number) => (
                                <button
                                    key={pr.name}
                                    onClick={() => { setSelectedExercise(pr.name); setShowExerciseModal(true); }}
                                    className="w-full flex items-center justify-between p-3.5 bg-surface-elevated/50 hover:bg-surface-elevated rounded-xl transition-all group text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black",
                                            i === 0 ? "bg-warning/10 text-warning" :
                                            i === 1 ? "bg-fg-subtle/10 text-fg-subtle" :
                                            i === 2 ? "bg-amber-700/10 text-amber-600" :
                                            "bg-surface-muted text-fg-subtle"
                                        )}>
                                            {i < 3 ? "🏆" : (i + 1)}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-fg group-hover:text-brand-400 transition-colors uppercase italic tracking-tighter">{pr.name}</p>
                                            <p className="text-[10px] text-fg-muted font-bold">
                                                {pr.date}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-fg">
                                            {pr.weight}<span className="text-[10px] text-fg-muted ml-0.5">kg</span>
                                            <span className="text-[10px] font-bold text-fg-subtle ml-1 opacity-60">× {pr.reps}</span>
                                        </p>
                                        {pr.improvement > 0 && (
                                            <p className="text-[10px] font-bold text-success">+{pr.improvement}%</p>
                                        )}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Volume Trend */}
                <div className="card p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <BarChart2 className="w-5 h-5 text-success" />
                            <h3 className="text-sm font-black text-fg uppercase tracking-widest">Training Volume</h3>
                        </div>
                        <div className="flex bg-surface-muted p-1 rounded-xl self-start shrink-0">
                            {(["daily", "weekly", "monthly", "yearly"] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setVolTimeframe(t)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                        volTimeframe === t ? "bg-surface-card text-brand-400 shadow-sm" : "text-fg-subtle hover:text-fg"
                                    )}
                                >
                                    {t.charAt(0)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.volumes?.[volTimeframe] || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                                <XAxis dataKey="label" stroke="#4B5563" fontSize={9} tickLine={false} axisLine={false} />
                                <YAxis stroke="#4B5563" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: "#0F172A", borderRadius: "12px", border: "1px solid #1E293B" }}
                                    formatter={(value: any) => [`${value.toLocaleString()} kg`, "Volume"]}
                                    cursor={{ fill: '#8B5CF610' }}
                                    labelStyle={{ color: "#6B7280", fontSize: 10, fontWeight: 800 }}
                                />
                                <Bar dataKey="volume" radius={[6, 6, 0, 0]} barSize={volTimeframe === 'daily' ? 12 : 28}>
                                    {(data.volumes?.[volTimeframe] || []).map((_: any, index: number) => {
                                        const isLast = index === (data.volumes?.[volTimeframe] || []).length - 1;
                                        return (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={isLast ? "#8B5CF6" : "#1E293B"}
                                                stroke={isLast ? "#8B5CF6" : "#374151"}
                                                strokeWidth={1}
                                            />
                                        );
                                    })}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-[9px] text-fg-subtle font-bold uppercase tracking-widest mt-3 text-center">
                        Total kg moved per {volTimeframe.replace('ly', '').replace('i', 'y')} · Latest period highlighted
                    </p>
                </div>
            </section>

            {/* ── EXERCISE HISTORY ── */}
            <section>
                <h2 className="text-xs font-black text-fg-subtle uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-brand-400" />
                    Exercise History
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Chart */}
                    <div className="lg:col-span-8 card overflow-hidden">
                        <div className="p-5 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-base font-black text-fg tracking-tight">{selectedExercise || "Select an exercise"}</h3>
                                <p className="text-[10px] text-fg-muted font-medium mt-0.5">Performance curve over time</p>
                            </div>
                        </div>
                        <div className="p-5 sm:p-6">
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.exerciseHistory[selectedExercise] || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="exGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                                        <XAxis dataKey="date" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                        <Tooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    const d = payload[0].payload;
                                                    return (
                                                        <div className="bg-surface-elevated/95 backdrop-blur-md border border-brand-500/20 p-4 rounded-2xl shadow-2xl">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle mb-2">{label}</p>
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center justify-between gap-6 pb-1">
                                                                    <span className="text-xs font-black text-fg">Best Set</span>
                                                                    <span className="text-xs font-bold text-brand-400">{d.weight}kg × {d.reps}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-6 pt-1.5 border-t border-surface-border/50">
                                                                    <span className="text-xs text-fg-muted">Est. 1RM</span>
                                                                    <span className="text-xs font-bold text-yellow-400">{d.oneRM || "—"}kg</span>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-6 pt-1.5 border-t border-surface-border/50">
                                                                    <span className="text-xs text-fg-muted">Volume</span>
                                                                    <span className="text-xs font-bold text-success">{Math.round(d.volume)}kg</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Area
                                            type="monotone" dataKey="weight" stroke="#8B5CF6" strokeWidth={3}
                                            fill="url(#exGrad)"
                                            dot={{ r: 4, fill: "#8B5CF6", stroke: "#0F172A", strokeWidth: 2 }}
                                            activeDot={{ r: 6, fill: "#A78BFA", strokeWidth: 0 }}
                                            animationDuration={800}
                                        />
                                        <Line 
                                            type="monotone" 
                                            dataKey="oneRM" 
                                            stroke="#FACC15" 
                                            strokeWidth={2} 
                                            strokeDasharray="5 5" 
                                            dot={false}
                                            activeDot={false}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Exercise Library */}
                    <div className="lg:col-span-4 card flex flex-col max-h-[460px]">
                        <div className="p-4 border-b border-surface-border">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle" />
                                <input
                                    type="text"
                                    className="pl-9 pr-4 py-2.5 w-full bg-surface-elevated border border-surface-border rounded-xl text-xs font-bold outline-none focus:border-brand-500/50 transition-all"
                                    placeholder="Search exercises..."
                                    value={exerciseSearchQuery}
                                    onChange={(e) => setExerciseSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                            {exerciseList.map(ex => {
                                const hist = data.exerciseHistory[ex];
                                const latest = hist[hist.length - 1];
                                const isActive = selectedExercise === ex;
                                return (
                                    <button
                                        key={ex}
                                        onClick={() => { setSelectedExercise(ex); setShowExerciseModal(false); }}
                                        className={cn(
                                            "w-full flex items-center justify-between p-3 rounded-xl transition-all text-left",
                                            isActive ? "bg-brand-500/10 border border-brand-500/20" : "hover:bg-surface-elevated border border-transparent"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", isActive ? "bg-brand-500 text-white" : "bg-surface-muted text-fg-subtle")}>
                                                <Dumbbell className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className={cn("text-xs font-black truncate", isActive ? "text-brand-400" : "text-fg")}>{ex}</p>
                                                <p className="text-[10px] text-fg-muted truncate">Best: {latest?.weight}kg · {hist.length} sessions</p>
                                            </div>
                                        </div>
                                        <ChevronRight className={cn("w-4 h-4 shrink-0 transition-opacity", isActive ? "text-brand-400 opacity-100" : "opacity-0")} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── EXERCISE DETAIL MODAL ── */}
            {showExerciseModal && selectedExercise && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowExerciseModal(false)}>
                    <div className="bg-surface-card border border-surface-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-6 border-b border-surface-border sticky top-0 bg-surface-card/95 backdrop-blur-md z-10">
                            <div>
                                <h3 className="text-lg font-black text-fg tracking-tight">{selectedExercise}</h3>
                                <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest mt-1">
                                    {(data.exerciseHistory[selectedExercise] || []).length} sessions logged
                                </p>
                            </div>
                            <button onClick={() => setShowExerciseModal(false)} className="w-8 h-8 rounded-lg bg-surface-muted hover:bg-surface-elevated flex items-center justify-center transition-colors">
                                <X className="w-4 h-4 text-fg-muted" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Graph */}
                            <div className="h-[240px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.exerciseHistory[selectedExercise] || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="modalGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                                        <XAxis dataKey="date" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: "#0F172A", borderRadius: "12px", border: "1px solid #1E293B" }}
                                            formatter={(value: any, name: any) => 
                                                name === "weight" ? [`${value}kg`, "Best Weight"] : 
                                                name === "oneRM" ? [`${value}kg`, "Est. 1RM"] : 
                                                [`${value}`, name]}
                                            labelStyle={{ color: "#6B7280", fontSize: 10, fontWeight: 800 }}
                                        />
                                        <Area type="monotone" dataKey="weight" stroke="#8B5CF6" strokeWidth={3} fill="url(#modalGrad)" dot={{ r: 4, fill: "#8B5CF6", stroke: "#0F172A", strokeWidth: 2 }} />
                                        <Line type="monotone" dataKey="oneRM" stroke="#FACC15" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Session History Table */}
                            <div>
                                <h4 className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-3">Session Log</h4>
                                <div className="space-y-2">
                                    {(data.exerciseHistory[selectedExercise] || []).slice().reverse().map((session: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-surface-elevated/50 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-bold text-fg-subtle w-16 whitespace-nowrap">{session.date}</span>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-fg">{session.weight}kg × {session.reps}</span>
                                                    <span className="text-[9px] font-bold text-yellow-500/80">Est. 1RM: {session.oneRM}kg</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-bold text-fg-muted">Vol: {Math.round(session.volume)}kg</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

