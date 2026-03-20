"use client";

import { useState, useEffect } from "react";
import { 
    LineChart, Line, AreaChart, Area, BarChart, Bar, 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell 
} from "recharts";
import { 
    TrendingUp, Clock, Flame, Calendar, 
    ChevronRight, Info, Award, Loader2,
    Dumbbell, Target, Activity, Lock, ArrowRight,
    Search, ChevronDown, ListFilter
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
                <p className="text-fg-muted animate-pulse font-medium">Crunching workout numbers...</p>
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

    const muscleData = Object.entries(data.muscleVolume).map(([name, value]) => ({ name, value }));
    const exerciseData = data.exerciseHistory[selectedExercise] || [];
    const exerciseNames = Object.keys(data.exerciseHistory);

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in mb-24 lg:mb-12">
            {/* Executive Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                {[
                    { label: "Completed", val: data.totalWorkouts, icon: Activity, color: "text-brand-400", bg: "bg-brand-400/10" },
                    { label: "Best Lifts (PRs)", val: data.totalPRs, icon: Award, color: "text-success", bg: "bg-success/10" },
                    { label: "Avg Depth", val: "52m", icon: Clock, color: "text-warning", bg: "bg-warning/10" },
                    { label: "Consistency", val: "High", icon: Target, color: "text-brand-300", bg: "bg-brand-300/10" },
                ].map((s) => (
                    <div key={s.label} className="card p-5 group hover:border-brand-500/30 transition-all border border-surface-border bg-surface-card">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", s.bg)}>
                            <s.icon className={cn("w-5 h-5", s.color)} />
                        </div>
                        <p className="text-2xl font-black text-fg tracking-tight">{s.val}</p>
                        <p className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Visual Analysis Pane */}
                <div className="lg:col-span-8 space-y-8">
                    {/* The Big Graph */}
                    <div className="card overflow-hidden bg-surface-card">
                        <div className="p-6 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                            <div className="space-y-1">
                                <h3 className="text-lg font-black text-fg tracking-tighter">Performance Curve</h3>
                                <p className="text-xs text-fg-muted font-medium">Tracking top sets over your training history</p>
                            </div>
                            
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                                {exerciseNames.slice(0, 3).map(ex => (
                                    <button
                                        key={ex}
                                        onClick={() => setSelectedExercise(ex)}
                                        className={cn(
                                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                                            selectedExercise === ex 
                                                ? "bg-brand-500 border-brand-500 text-white shadow-glow-brand-sm" 
                                                : "bg-surface-elevated border-surface-border text-fg-subtle hover:text-fg"
                                        )}
                                    >
                                        {ex}
                                    </button>
                                ))}
                                <div className="relative shrink-0">
                                    <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-fg-subtle pointer-events-none" />
                                    <select 
                                        className="pl-8 pr-4 py-2 bg-surface-elevated border border-surface-border rounded-xl text-[10px] font-black uppercase tracking-widest outline-none appearance-none hover:border-brand-500/40 transition-all min-w-[120px]"
                                        value={selectedExercise}
                                        onChange={(e) => setSelectedExercise(e.target.value)}
                                    >
                                        {exerciseNames.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-8">
                            <div className="h-[320px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={exerciseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                        <XAxis dataKey="date" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: "#020617", borderRadius: "16px", border: "1px solid #1E293B", color: "#F8FAFC", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)" }}
                                            cursor={{ stroke: '#8B5CF6', strokeWidth: 1 }}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="weight" 
                                            stroke="#8B5CF6" 
                                            strokeWidth={4} 
                                            fill="url(#curveGrad)" 
                                            dot={{ r: 5, fill: "#8B5CF6", stroke: "#0F172A", strokeWidth: 2 }} 
                                            activeDot={{ r: 8, fill: "#A78BFA", strokeWidth: 0 }}
                                            animationDuration={1000}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        {/* Monthly Output */}
                        <div className="card p-6 bg-surface-card">
                            <div className="flex items-center gap-3 mb-6">
                                <Activity className="w-5 h-5 text-brand-400" />
                                <h3 className="text-sm font-black text-fg uppercase tracking-widest">Training Output</h3>
                            </div>
                            <div className="h-[220px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={data.workoutFrequencies}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                        <XAxis dataKey="month" stroke="#6B7280" fontSize={9} hide />
                                        <YAxis stroke="#6B7280" fontSize={9} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{ backgroundColor: "#020617", borderRadius: "12px", border: "1px solid #1E293B" }} />
                                        <Line type="stepAfter" dataKey="count" stroke="#10B981" strokeWidth={3} dot={true} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        {/* Session Breakdown */}
                        <div className="card p-6 bg-surface-card">
                            <div className="flex items-center gap-3 mb-6">
                                <Clock className="w-5 h-5 text-warning" />
                                <h3 className="text-sm font-black text-fg uppercase tracking-widest">Session Intensity</h3>
                            </div>
                            <div className="h-[220px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.sessionDurations.slice(-8)}>
                                        <XAxis dataKey="date" hide />
                                        <YAxis stroke="#6B7280" fontSize={9} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{ backgroundColor: "#020617", borderRadius: "12px", border: "1px solid #1E293B" }} />
                                        <Bar dataKey="duration" fill="#F59E0B" radius={[6, 6, 0, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tactical Pane */}
                <div className="lg:col-span-4 space-y-8">
                    {/* Muscle Architecture */}
                    <div className="card p-6 bg-surface-card">
                        <h3 className="text-sm font-black text-fg uppercase tracking-widest mb-8">Volume Distribution</h3>
                        <div className="h-[260px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={muscleData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={75}
                                        outerRadius={95}
                                        paddingAngle={8}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {muscleData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                                <p className="text-[10px] font-bold text-fg-subtle uppercase">Targeted</p>
                                <p className="text-xl font-black text-brand-400 tracking-tighter">
                                    {(muscleData as any[]).sort((a,b) => b.value - a.value)[0]?.name || "N/A"}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-8 justify-center">
                            {muscleData.map((m, i) => (
                                <div key={m.name} className="flex items-center gap-2 px-3 py-1.5 bg-surface-elevated rounded-full border border-surface-border">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                    <span className="text-[9px] text-fg-muted font-black uppercase tracking-wider">{m.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* All Exercise Stats - Clickable to Graph */}
                    <div className="card bg-surface-card h-fit overflow-hidden">
                        <div className="p-5 border-b border-surface-border bg-gradient-to-r from-brand-950/10 to-transparent">
                            <h3 className="text-sm font-black text-fg uppercase tracking-widest">Exercise Library</h3>
                        </div>
                        <div className="p-2 space-y-1 max-h-[500px] overflow-y-auto no-scrollbar">
                            {exerciseNames.map(ex => {
                                const hist = data.exerciseHistory[ex];
                                const latest = hist[hist.length - 1];
                                const isActive = selectedExercise === ex;
                                
                                return (
                                    <button 
                                        key={ex} 
                                        onClick={() => setSelectedExercise(ex)}
                                        className={cn(
                                            "w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200 group text-left",
                                            isActive 
                                                ? "bg-brand-500/10 border border-brand-500/30" 
                                                : "hover:bg-surface-elevated border border-transparent"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-sm",
                                                isActive ? "bg-brand-500 text-white" : "bg-surface-elevated text-fg-subtle group-hover:text-brand-400 group-hover:bg-brand-400/10"
                                            )}>
                                                <Dumbbell className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className={cn("text-xs font-black transition-colors", isActive ? "text-brand-400" : "text-fg")}>{ex}</p>
                                                <p className="text-[10px] text-fg-muted font-bold uppercase tracking-tight">Best: {latest.weight}kg</p>
                                            </div>
                                        </div>
                                        <ChevronRight className={cn("w-4 h-4 transition-all", isActive ? "text-brand-400 translate-x-0" : "text-fg-subtle translate-x-[-10px] opacity-0 group-hover:opacity-100 group-hover:translate-x-0")} />
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
