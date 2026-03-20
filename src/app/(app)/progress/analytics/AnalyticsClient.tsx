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
    Dumbbell, Target, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];

export function AnalyticsClient() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedExercise, setSelectedExercise] = useState<string>("");

    useEffect(() => {
        fetch("/api/stats")
            .then(res => res.json())
            .then(d => {
                setData(d);
                const exercises = Object.keys(d.exerciseHistory);
                if (exercises.length > 0) setSelectedExercise(exercises[0]);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
                <p className="text-fg-muted animate-pulse">Calculating your gains...</p>
            </div>
        );
    }

    const muscleData = Object.entries(data.muscleVolume).map(([name, value]) => ({ name, value }));
    const exerciseData = data.exerciseHistory[selectedExercise] || [];

    return (
        <div className="space-y-8 pb-12 animate-fade-in">
            {/* Top Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Total Sessions", val: data.totalWorkouts, icon: Activity, color: "text-brand-400" },
                    { label: "Personal Records", val: data.totalPRs, icon: Award, color: "text-success" },
                    { label: "Avg duration", val: "48m", icon: Clock, color: "text-warning" },
                    { label: "Weekly Freq", val: "3.2", icon: Calendar, color: "text-brand-300" },
                ].map((s) => (
                    <div key={s.label} className="stat-card p-4">
                        <s.icon className={cn("w-4 h-4 mb-2", s.color)} />
                        <p className="stat-value text-2xl">{s.val}</p>
                        <p className="stat-label">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Exercise Progress Over Time */}
                <div className="lg:col-span-8 space-y-4">
                    <div className="card p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div>
                                <h3 className="heading-3">Exercise Progress</h3>
                                <p className="text-xs text-fg-muted">Tracking your strength and volume trends</p>
                            </div>
                            <select 
                                className="input-sm bg-surface-muted border-none max-w-[200px]"
                                value={selectedExercise}
                                onChange={(e) => setSelectedExercise(e.target.value)}
                            >
                                {Object.keys(data.exerciseHistory).map(ex => (
                                    <option key={ex} value={ex}>{ex}</option>
                                ))}
                            </select>
                        </div>

                        <div className="h-[300px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={exerciseData}>
                                    <defs>
                                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                    <XAxis 
                                        dataKey="date" 
                                        stroke="#9CA3AF" 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false}
                                    />
                                    <YAxis 
                                        stroke="#9CA3AF" 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false}
                                        label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF', fontSize: 10 } }}
                                    />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: "#111827", borderRadius: "12px", border: "1px solid #374151" }}
                                        itemStyle={{ color: "#8B5CF6" }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="weight" 
                                        stroke="#8B5CF6" 
                                        strokeWidth={3}
                                        fillOpacity={1} 
                                        fill="url(#colorWeight)" 
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Session Duration History */}
                    <div className="card p-6">
                        <h3 className="heading-3 mb-6">Session Durations</h3>
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.sessionDurations}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                    <XAxis 
                                        dataKey="date" 
                                        stroke="#9CA3AF" 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false}
                                    />
                                    <YAxis 
                                        stroke="#9CA3AF" 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false}
                                        label={{ value: 'Mins', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF', fontSize: 10 } }}
                                    />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: "#111827", borderRadius: "12px", border: "1px solid #374151" }}
                                    />
                                    <Bar dataKey="duration" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Right Side Cards */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Muscle Group Volume */}
                    <div className="card p-6">
                        <h3 className="heading-3 mb-6">Volume Split</h3>
                        <div className="h-[240px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={muscleData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {muscleData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-4">
                            {muscleData.map((m, i) => (
                                <div key={m.name} className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                    <span className="text-[10px] text-fg-muted font-medium truncate">{m.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* PR Leaderboard / Highlights */}
                    <div className="card p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="heading-3">Highlights</h3>
                            <Award className="w-4 h-4 text-warning" />
                        </div>
                        <div className="space-y-4">
                            {Object.entries(data.exerciseHistory).slice(0, 4).map(([name, hist]: any) => {
                                const latest = hist[hist.length - 1];
                                return (
                                    <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-surface-muted/50 border border-surface-border">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-brand-400/10 flex items-center justify-center">
                                                <Dumbbell className="w-4 h-4 text-brand-400" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-fg">{name}</p>
                                                <p className="text-[10px] text-fg-muted">Latest: {latest.weight}kg</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <TrendingUp className="w-3 h-3 text-success ml-auto mb-1" />
                                            <p className="text-[10px] font-black text-success">PR SET</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
