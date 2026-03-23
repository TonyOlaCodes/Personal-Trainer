"use client";

import { useState, useEffect, useMemo } from "react";
import { 
    LineChart, Line, AreaChart, Area, BarChart, Bar, 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell 
} from "recharts";
import { 
    TrendingUp, Clock, Flame, Calendar, 
    ChevronRight, Info, Award, Loader2,
    Dumbbell, Target, Activity, Lock, ArrowRight,
    Search, ChevronDown, ListFilter, TrendingDown,
    Scale, Zap, Trophy, BarChart2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumLockScreen } from "@/components/shared/PremiumLockScreen";
import Link from "next/link";

const COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];

interface Props {
    userRole: string;
}

export function ProgressClient({ userRole }: Props) {
    const isPremium = ["PREMIUM", "COACH", "SUPER_ADMIN"].includes(userRole);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedExercise, setSelectedExercise] = useState<string>("");
    const [curveSearchQuery, setCurveSearchQuery] = useState("");
    const [librarySearchQuery, setLibrarySearchQuery] = useState("");
    const [bwDays, setBwDays] = useState<7 | 30 | 90>(30);

    useEffect(() => {
        if (!isPremium) {
            setLoading(false);
            return;
        }

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

    // Regex fuzzy filter
    const getRegex = (q: string) => {
        try {
            return new RegExp(q.trim().split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*'), 'i');
        } catch(e) {
            return new RegExp(q, 'i');
        }
    };

    const libraryFiltered = useMemo(() => {
        if (!data) return [];
        const names = Object.keys(data.exerciseHistory);
        return names.filter(ex => librarySearchQuery ? getRegex(librarySearchQuery).test(ex) : true);
    }, [data, librarySearchQuery]);

    const curveFiltered = useMemo(() => {
        if (!data) return [];
        const names = Object.keys(data.exerciseHistory);
        return names.filter(ex => curveSearchQuery ? getRegex(curveSearchQuery).test(ex) : true);
    }, [data, curveSearchQuery]);

    if (!isPremium) {
        return (
            <div className="p-4 sm:p-10">
                <PremiumLockScreen 
                    title="Elite Progress Analytics" 
                    description="Advanced progress tracking is available to Premium members. Upgrade to get professional strength analysis, muscle distribution splits, and historical session breakdowns."
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
                <p className="text-sm text-fg-muted mb-6">Complete a workout to see your strength curves come to life.</p>
                <Link href="/dashboard" className="btn-primary mx-auto">Start Today's Workout</Link>
            </div>
        );
    }

    const bodyweightData = data.bodyweight.history.slice(-bwDays);

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-10 animate-fade-in mb-24 lg:mb-12">
            
            {/* 1. Overview Section */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                <div className="card p-5 border-l-4 border-l-brand-500">
                    <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1">Bodyweight</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-fg">{data.bodyweight.current || "--"}</span>
                        <span className="text-xs font-bold text-fg-muted">kg</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                        {data.bodyweight.changeWeek >= 0 ? 
                            <TrendingUp className="w-3.5 h-3.5 text-success" /> : 
                            <TrendingDown className="w-3.5 h-3.5 text-danger" />
                        }
                        <span className={cn("text-[10px] font-bold", data.bodyweight.changeWeek >= 0 ? "text-success" : "text-danger")}>
                            {data.bodyweight.changeWeek > 0 ? "+" : ""}{data.bodyweight.changeWeek.toFixed(1)}kg this week
                        </span>
                    </div>
                </div>

                <div className="card p-5">
                    <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1">Net Progress</p>
                    <div className="flex items-baseline gap-1">
                        <span className={cn("text-2xl font-black", data.bodyweight.totalChange < 0 ? "text-success" : "text-fg")}>
                            {data.bodyweight.totalChange > 0 ? "+" : ""}{data.bodyweight.totalChange.toFixed(1)}
                        </span>
                        <span className="text-xs font-bold text-fg-muted">kg total</span>
                    </div>
                    <p className="text-[10px] text-fg-subtle font-bold mt-2 uppercase tracking-tight">Since onboarding</p>
                </div>

                <div className="card p-5">
                    <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1">Consistency</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-fg">{data.consistency.thisWeek}</span>
                        <span className="text-sm font-bold text-fg-subtle">/ {data.consistency.target}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                        <Activity className="w-3.5 h-3.5 text-brand-400" />
                        <span className="text-[10px] font-bold text-fg-muted uppercase">{data.consistency.lastWeek} workouts last week</span>
                    </div>
                </div>

                <div className="card p-5">
                    <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1">Grand Total</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-fg">{data.totalWorkouts}</span>
                        <Trophy className="w-4 h-4 text-warning" />
                    </div>
                    <p className="text-[10px] text-fg-subtle font-bold mt-2 uppercase tracking-tight">Workouts logged</p>
                </div>
            </div>

            {/* 2. Bodyweight Graph */}
            <div className="card p-6 bg-surface-card overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <Scale className="w-5 h-5 text-brand-400" />
                        <h3 className="text-sm font-black text-fg uppercase tracking-widest">Bodyweight Trend</h3>
                    </div>
                    <div className="flex bg-surface-muted p-1 rounded-xl">
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
                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={bodyweightData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                            <XAxis dataKey="date" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: "#020617", borderRadius: "16px", border: "1px solid #1E293B" }}
                                itemStyle={{ color: "#A78BFA", fontWeight: 800 }}
                            />
                            <Area type="monotone" dataKey="weight" stroke="#8B5CF6" strokeWidth={3} fill="url(#bwGrad)" dot={{ r: 4, fill: "#8B5CF6" }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 3. Strength Progress (Big 3) */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-warning" />
                    <h3 className="text-sm font-black text-fg uppercase tracking-widest">Strength Evolution (Est. 1RM)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {["Bench Press", "Squat", "Deadlift"].map((lift) => {
                        const stats = data.big3[lift];
                        const history = data.exerciseHistory[Object.keys(data.exerciseHistory).find(k => k.toLowerCase().includes(lift.toLowerCase())) || ""];
                        const progressData = history?.map((h: any) => ({ val: Math.round(h.weight * (1 + h.reps / 30)) })) || [];

                        return (
                            <div key={lift} className="card p-6 bg-surface-card hover:border-brand-500/30 transition-all border border-surface-border">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest">{lift}</p>
                                        <h4 className="text-3xl font-black text-fg tracking-tighter mt-1">
                                            {stats?.oneRM || "--"}
                                            <span className="text-sm text-fg-muted ml-1">kg</span>
                                        </h4>
                                    </div>
                                    {stats?.change > 0 && (
                                        <div className="bg-success/10 text-success text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3" />
                                            +{stats.change}kg
                                        </div>
                                    )}
                                </div>
                                
                                <div className="h-16 w-full mb-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={progressData}>
                                            <Line type="monotone" dataKey="val" stroke="#8B5CF6" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="flex items-center justify-between text-[10px] font-bold text-fg-muted uppercase tracking-tight">
                                    <span>Last Set: {stats?.weight}kg × {stats?.reps}</span>
                                    <span>{stats?.date}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 4. PR Tracker & 6. Volume Tracking */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* PR Tracker */}
                <div className="card p-6 bg-surface-card">
                    <div className="flex items-center gap-3 mb-8">
                        <Trophy className="w-5 h-5 text-brand-400" />
                        <h3 className="text-sm font-black text-fg uppercase tracking-widest">Recent Milestones</h3>
                    </div>
                    <div className="space-y-4">
                        {Object.entries(data.big3).filter(([_, s]: any) => s.oneRM > 0).map(([lift, s]: any) => (
                            <div key={lift} className="flex items-center justify-between p-4 bg-surface-elevated rounded-2xl border border-surface-border/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400">
                                        <Award className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-fg">{lift}</p>
                                        <p className="text-[10px] text-fg-muted font-bold uppercase tracking-tight">New PR: {s.weight}kg</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-success">+{s.change}kg</p>
                                    <p className="text-[9px] text-fg-subtle font-bold uppercase tracking-tighter">Growth</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Volume Trend */}
                <div className="card p-6 bg-surface-card">
                    <div className="flex items-center gap-3 mb-8">
                        <BarChart2 className="w-5 h-5 text-success" />
                        <h3 className="text-sm font-black text-fg uppercase tracking-widest">Weekly Work Volume</h3>
                    </div>
                    <div className="h-[240px] w-full text-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.weeklyVolume}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis dataKey="week" stroke="#6B7280" fontSize={9} tickLine={false} axisLine={false} />
                                <YAxis hide />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: "#020617", borderRadius: "12px", border: "1px solid #1E293B" }}
                                    cursor={{ fill: '#8B5CF610' }}
                                />
                                <Bar dataKey="volume" fill="#10B981" radius={[6, 6, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                        <p className="text-[9px] text-fg-subtle font-black uppercase tracking-widest mt-4 italic">Total kg per week across all sets</p>
                    </div>
                </div>
            </div>

            {/* 7. Exercise-specific Progress (Detailed Section) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Chart Pane */}
                <div className="lg:col-span-8">
                    <div className="card bg-surface-card">
                        <div className="p-6 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                            <div className="space-y-1">
                                <h3 className="text-lg font-black text-fg tracking-tighter">Exercise Performance Curve</h3>
                                <p className="text-xs text-fg-muted font-medium">Deep dive into individual movement history</p>
                            </div>
                            
                            <div className="relative shrink-0 w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-fg-subtle" />
                                <input 
                                    type="text"
                                    placeholder="Search library..."
                                    className="pl-8 pr-12 py-2 w-full bg-surface-elevated border border-surface-border rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-brand-500/60 transition-all"
                                    value={curveSearchQuery}
                                    onChange={(e) => setCurveSearchQuery(e.target.value)}
                                />
                                {curveSearchQuery && (
                                    <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-surface-elevated border border-surface-border rounded-xl shadow-2xl max-h-[200px] overflow-y-auto no-scrollbar animate-slide-up">
                                        {curveFiltered.map(ex => (
                                            <button
                                                key={ex}
                                                onClick={() => { setSelectedExercise(ex); setCurveSearchQuery(""); }}
                                                className={cn(
                                                    "w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-brand-500/10 hover:text-brand-400 transition-colors border-b last:border-0 border-surface-border/50",
                                                    selectedExercise === ex ? "text-brand-400 bg-brand-500/5" : "text-fg-subtle"
                                                )}
                                            >
                                                {ex}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="p-8">
                            <div className="h-[320px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.exerciseHistory[selectedExercise] || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="mainCurveGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                        <XAxis dataKey="date" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                        <Tooltip 
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    const d = payload[0].payload;
                                                    return (
                                                        <div className="bg-surface-elevated/90 backdrop-blur-md border border-brand-500/20 p-4 rounded-2xl shadow-2xl">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle mb-2">{label}</p>
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center justify-between gap-6 font-black uppercase tracking-tighter">
                                                                    <span className="text-xs text-fg">Best Set</span>
                                                                    <span className="text-xs text-brand-400">{d.weight}kg × {d.reps}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-6 font-black uppercase tracking-tighter border-t border-surface-border/50 pt-1.5 mt-1.5">
                                                                    <span className="text-xs text-fg-muted">Vol</span>
                                                                    <span className="text-xs text-success">{Math.round(d.volume)}kg</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="weight" 
                                            stroke="#8B5CF6" 
                                            strokeWidth={4} 
                                            fill="url(#mainCurveGrad)" 
                                            dot={{ r: 4, fill: "#8B5CF6", stroke: "#0F172A", strokeWidth: 2 }} 
                                            activeDot={{ r: 6, fill: "#A78BFA", strokeWidth: 0 }}
                                            animationDuration={1500}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Library Pane */}
                <div className="lg:col-span-4">
                    <div className="card bg-surface-card flex flex-col h-full max-h-[500px]">
                        <div className="p-5 border-b border-surface-border">
                            <h3 className="text-sm font-black text-fg uppercase tracking-widest">Library Search</h3>
                            <div className="relative mt-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-fg-subtle" />
                                <input 
                                    type="text"
                                    className="input-sm pl-8 w-full"
                                    placeholder="Type exercise..."
                                    value={librarySearchQuery}
                                    onChange={(e) => setLibrarySearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                            {libraryFiltered.map(ex => {
                                const hist = data.exerciseHistory[ex];
                                const latest = hist[hist.length - 1];
                                const isActive = selectedExercise === ex;
                                return (
                                    <button 
                                        key={ex}
                                        onClick={() => setSelectedExercise(ex)}
                                        className={cn(
                                            "w-full flex items-center justify-between p-3 rounded-xl transition-all",
                                            isActive ? "bg-brand-500/10 border border-brand-500/30" : "hover:bg-surface-elevated"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isActive ? "bg-brand-500 text-white" : "bg-surface-muted text-fg-subtle")}>
                                                <BarChart2 className="w-4 h-4" />
                                            </div>
                                            <div className="text-left">
                                                <p className={cn("text-xs font-black", isActive ? "text-brand-400" : "text-fg")}>{ex}</p>
                                                <p className="text-[10px] text-fg-muted font-bold uppercase tracking-tighter">Best: {latest?.weight}kg</p>
                                            </div>
                                        </div>
                                        <ChevronRight className={cn("w-4 h-4", isActive ? "text-brand-400" : "text-fg-subtle opacity-0")} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
