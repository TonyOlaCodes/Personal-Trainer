"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Plus, Minus, Save, ChevronLeft, Dumbbell,
    Settings, Layout, Calendar, CheckCircle2,
    Trash2, ChevronRight, Copy, ChevronDown, ChevronUp, GripVertical, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_TEMPLATES } from "@/lib/templates";

interface LocalExercise {
    name: string;
    sets: number;
    reps: string;
    weightTargetKg?: number;
    order: number;
}

interface LocalWorkout {
    name: string;
    dayNumber: number;
    dayOfWeek?: number | null; // 0=Sun, 1=Mon, ..., 6=Sat
    exercises: LocalExercise[];
}

export function PlanCreateClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const templateId = searchParams.get("template");
    const editId = searchParams.get("id");

    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [workouts, setWorkouts] = useState<LocalWorkout[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeIdx, setActiveIdx] = useState(0);

    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Load data (Template or Edit)
    useEffect(() => {
        const load = async () => {
            if (editId) {
                setLoading(true);
                try {
                    const res = await fetch(`/api/plans/${editId}`);
                    const data = await res.json();
                    if (res.ok) {
                        setName(data.name);
                        setDesc(data.description || "");
                        // Use the first week's workouts
                        const workouts = data.weeks[0]?.workouts || [];
                        setWorkouts(workouts.map((w: any) => ({
                            name: w.name,
                            dayNumber: w.dayNumber,
                            dayOfWeek: w.dayOfWeek,
                            exercises: w.exercises.map((e: any) => ({
                                name: e.name,
                                sets: e.sets,
                                reps: e.reps,
                                weightTargetKg: e.weightTargetKg,
                                order: e.order
                            }))
                        })));
                    }
                } catch (e) {
                    console.error("Failed to fetch plan:", e);
                } finally {
                    setLoading(false);
                }
            } else if (templateId && PLAN_TEMPLATES[templateId]) {
                const t = PLAN_TEMPLATES[templateId];
                setName(t.name);
                setDesc(t.description);
                setWorkouts(t.workouts.map(w => ({
                    name: w.name,
                    dayNumber: w.dayNumber,
                    dayOfWeek: w.dayNumber % 7 || 7, // Default Mon-Sun cyclic
                    exercises: w.exercises.map((e, idx) => ({ ...e, order: idx }))
                })));
            } else {
                setWorkouts([
                    { name: "Full Body A", dayNumber: 1, dayOfWeek: 1, exercises: [] }
                ]);
            }
        };
        load();
    }, [templateId, editId]);

    const addWorkout = () => {
        const nextIdx = workouts.length;
        
        // Find next available day of week
        let nextDow = (nextIdx + 1) % 7 || 7;
        const usedDows = workouts.map(w => w.dayOfWeek);
        for (let i = 1; i <= 7; i++) {
            const check = i === 7 ? 0 : i; // Map 7 to 0 (Sunday)
            if (!usedDows.includes(check)) {
                nextDow = check;
                break;
            }
        }

        setWorkouts([...workouts, {
            name: `Day ${nextIdx + 1}`,
            dayNumber: nextIdx + 1,
            dayOfWeek: nextDow,
            exercises: []
        }]);
        setActiveIdx(nextIdx);
    };

    const removeWorkout = (idx: number) => {
        const next = workouts.filter((_, i) => i !== idx).map((w, i) => ({ ...w, dayNumber: i + 1 }));
        setWorkouts(next);
        if (activeIdx >= next.length) setActiveIdx(Math.max(0, next.length - 1));
    };

    const duplicateWorkout = (idx: number) => {
        const toDup = workouts[idx];
        const next = [...workouts];
        next.splice(idx + 1, 0, {
            ...JSON.parse(JSON.stringify(toDup)),
            name: `${toDup.name} (Copy)`,
            dayNumber: idx + 2
        });
        setWorkouts(next.map((w, i) => ({ ...w, dayNumber: i + 1 })));
        setActiveIdx(idx + 1);
    };

    const addExercise = (wIdx: number) => {
        const newWorkouts = [...workouts];
        newWorkouts[wIdx].exercises.push({
            name: "", sets: 3, reps: "10", order: newWorkouts[wIdx].exercises.length
        });
        setWorkouts(newWorkouts);
    };

    const updateExercise = (wIdx: number, eIdx: number, updates: Partial<LocalExercise>) => {
        const newWorkouts = [...workouts];
        newWorkouts[wIdx].exercises[eIdx] = { ...newWorkouts[wIdx].exercises[eIdx], ...updates };
        setWorkouts(newWorkouts);
    };

    const handleSubmit = async () => {
        if (!name) return alert("Give your plan a name!");
        setSaving(true);

        const payload = {
            name,
            description: desc,
            weeks: [{
                weekNumber: 1,
                workouts: workouts.map(w => ({
                    dayNumber: w.dayNumber,
                    dayOfWeek: w.dayOfWeek,
                    name: w.name,
                    exercises: w.exercises.filter(e => e.name.trim() !== "").map(e => ({
                        name: e.name,
                        sets: e.sets,
                        reps: e.reps,
                        weightTargetKg: e.weightTargetKg,
                        order: e.order
                    }))
                }))
            }]
        };

        try {
            const url = editId ? `/api/plans/${editId}` : "/api/plans";
            const method = editId ? "PATCH" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                router.push("/plans");
            } else {
                let errorMsg = "Failed to save plan";
                try {
                    const errData = await res.json();
                    errorMsg = errData.error || errorMsg;
                } catch (e) {
                    errorMsg = `Server Error (${res.status})`;
                }
                alert(`Error: ${errorMsg}`);
            }
        } catch (err) {
            console.error(err);
            alert("Connection error: Please check your internet or restart the server.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
                <p className="text-fg-muted animate-pulse">Loading plan details...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 animate-fade-in pb-24 lg:pb-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="btn-icon p-2">
                        <ChevronLeft className="w-5 h-5 text-fg-muted" />
                    </button>
                    <div>
                        <h2 className="heading-2 text-lg sm:text-2xl">{editId ? "Edit Plan" : "Plan Designer"}</h2>
                        <p className="text-xs text-brand-400 font-medium tracking-wide uppercase">
                            {templateId ? `${templateId.toUpperCase()} Template` : editId ? "Modifying Current Program" : "Custom Programme"}
                        </p>
                    </div>
                </div>
                <button onClick={handleSubmit} disabled={saving} className="btn-primary shadow-glow-brand h-10 px-6">
                    <Save className="w-4 h-4" />
                    {saving ? "Saving..." : editId ? "Update" : "Done"}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-4 order-2 lg:order-1">
                    <div className="card p-5 space-y-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="label">Plan Name</label>
                                <input
                                    type="text"
                                    className="input text-sm font-bold"
                                    placeholder="e.g. Hypertrophy Phase"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="label">Focus / Notes</label>
                                <textarea
                                    className="input h-20 text-xs py-3 resize-none"
                                    placeholder="Focus on progressive overload..."
                                    value={desc}
                                    onChange={(e) => setDesc(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="label px-1">Training Schedule</p>
                        <div className="space-y-2">
                            {workouts.map((w, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActiveIdx(i)}
                                    className={cn(
                                        "w-full text-left flex items-center justify-between p-3 rounded-xl transition-all duration-200 border",
                                        activeIdx === i 
                                            ? "bg-brand-950/40 border-brand-700/60 shadow-glow-sm" 
                                            : "bg-surface-card border-surface-border hover:bg-surface-muted"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold",
                                            activeIdx === i ? "bg-brand-400 text-white" : "bg-surface-elevated text-fg-subtle"
                                        )}>
                                            {w.dayNumber}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-fg truncate">{w.name}</p>
                                            <p className="text-[10px] text-fg-muted font-medium">
                                                {w.dayOfWeek !== null && w.dayOfWeek !== undefined ? DAYS[w.dayOfWeek] : "No Day"} • {w.exercises.length} Exercises
                                            </p>
                                        </div>
                                    </div>
                                    {activeIdx === i && <ChevronRight className="w-4 h-4 text-brand-400" />}
                                </button>
                            ))}
                            <button
                                onClick={addWorkout}
                                className="w-full py-3 border-2 border-dashed border-surface-border rounded-xl text-xs font-bold text-fg-subtle hover:text-brand-400 hover:border-brand-600/40 transition-all flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Add New Day
                            </button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-8 order-1 lg:order-2">
                    {workouts[activeIdx] ? (
                        <div className="space-y-4 animate-slide-up" key={activeIdx}>
                            <div className="card p-4 flex items-center justify-between bg-gradient-to-r from-surface-card to-brand-950/20">
                                <div className="flex items-center gap-4 flex-1">
                                     <div className="w-10 h-10 rounded-xl bg-brand-400/10 border border-brand-400/20 flex items-center justify-center">
                                         <Dumbbell className="w-5 h-5 text-brand-400" />
                                     </div>
                                     <div className="flex-1">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <label className="text-[10px] font-black text-brand-400 uppercase tracking-widest block">Day {workouts[activeIdx].dayNumber}</label>
                                            <div className="flex gap-1 overflow-x-auto no-scrollbar">
                                                {[1, 2, 3, 4, 5, 6, 0].map(d => {
                                                    const isUsed = workouts.some((w, idx) => idx !== activeIdx && w.dayOfWeek === d);
                                                    return (
                                                        <button
                                                            key={d}
                                                            onClick={() => {
                                                                if (isUsed) return alert(`${DAYS[d]} is already assigned in this plan.`);
                                                                const next = [...workouts];
                                                                next[activeIdx].dayOfWeek = d;
                                                                setWorkouts(next);
                                                            }}
                                                            className={cn(
                                                                "w-8 h-5 rounded text-[9px] font-black transition-all border shrink-0",
                                                                workouts[activeIdx].dayOfWeek === d
                                                                    ? "bg-brand-400 border-brand-400 text-white shadow-glow-brand-sm"
                                                                    : isUsed
                                                                        ? "bg-surface-muted border-surface-border text-fg-subtle opacity-40 cursor-not-allowed"
                                                                        : "bg-surface-elevated border-surface-border text-fg-subtle hover:text-fg"
                                                            )}
                                                            title={isUsed ? "Day already in use" : ""}
                                                        >
                                                            {DAYS[d]}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            className="bg-transparent border-none p-0 text-lg font-bold text-fg focus:ring-0 w-full"
                                            value={workouts[activeIdx].name}
                                            onChange={(e) => {
                                                const next = [...workouts];
                                                next[activeIdx].name = e.target.value;
                                                setWorkouts(next);
                                            }}
                                        />
                                     </div>
                                </div>
                                <div className="flex items-center gap-1 ml-4">
                                    <button onClick={() => duplicateWorkout(activeIdx)} className="btn-icon w-8 h-8 rounded-lg" title="Duplicate Day">
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => removeWorkout(activeIdx)} className="btn-icon w-8 h-8 rounded-lg text-danger/60 hover:text-danger hover:bg-danger/10" title="Delete Day">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {workouts[activeIdx].exercises.length === 0 ? (
                                    <div className="card p-12 text-center border-dashed border-2 bg-transparent">
                                        <p className="text-sm text-fg-subtle mb-4">No exercises added to this day yet.</p>
                                        <button onClick={() => addExercise(activeIdx)} className="btn-primary btn-sm">
                                            <Plus className="w-4 h-4" />
                                            Add First Exercise
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {workouts[activeIdx].exercises.map((ex, eIdx) => (
                                            <div key={eIdx} className="card p-4 group flex items-start gap-4">
                                                <div className="pt-2 text-fg-subtle flex flex-col items-center gap-1">
                                                    <span className="text-[10px] font-bold">{eIdx + 1}</span>
                                                </div>
                                                <div className="flex-1 grid grid-cols-12 gap-4">
                                                    <div className="col-span-12 sm:col-span-6">
                                                        <label className="label-mini block text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1 px-1">Exercise Name</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. Incline Bench Press"
                                                            className="w-full bg-surface-muted border border-surface-border rounded-xl px-4 py-2 text-sm text-fg"
                                                            value={ex.name}
                                                            onChange={(e) => updateExercise(activeIdx, eIdx, { name: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="col-span-6 sm:col-span-2">
                                                        <label className="label-mini block text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1 px-1">Sets</label>
                                                        <input
                                                            type="number"
                                                            className="w-full bg-surface-muted border border-surface-border rounded-xl px-4 py-2 text-sm text-fg text-center"
                                                            value={ex.sets}
                                                            onChange={(e) => updateExercise(activeIdx, eIdx, { sets: parseInt(e.target.value) || 0 })}
                                                        />
                                                    </div>
                                                    <div className="col-span-6 sm:col-span-3">
                                                        <label className="label-mini block text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1 px-1">Reps</label>
                                                        <input
                                                            type="text"
                                                            placeholder="8-12"
                                                            className="w-full bg-surface-muted border border-surface-border rounded-xl px-4 py-2 text-sm text-fg text-center"
                                                            value={ex.reps}
                                                            onChange={(e) => updateExercise(activeIdx, eIdx, { reps: e.target.value })}
                                                        />
                                                    </div>
                                                    <div className="col-span-12 sm:col-span-1 flex items-end">
                                                        <button
                                                            onClick={() => {
                                                                const next = [...workouts];
                                                                next[activeIdx].exercises = next[activeIdx].exercises.filter((_, i) => i !== eIdx);
                                                                setWorkouts(next);
                                                            }}
                                                            className="flex items-center justify-center w-full h-10 rounded-xl bg-danger-muted/5 text-danger/40 hover:text-danger hover:bg-danger-muted/20 transition-all"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
                                                <span className="text-[10px] font-bold text-fg-subtle uppercase whitespace-nowrap mr-1">Quick Add:</span>
                                                {["Bench Press", "Squat", "Deadlift", "Bicep Curls", "Lateral Raise", "Tricep Pushdown", "Lat Pulldown"].map(qEx => (
                                                    <button
                                                        key={qEx}
                                                        onClick={() => {
                                                            const next = [...workouts];
                                                            next[activeIdx].exercises.push({ name: qEx, sets: 3, reps: "10", order: next[activeIdx].exercises.length });
                                                            setWorkouts(next);
                                                        }}
                                                        className="px-3 py-1 bg-surface-muted border border-surface-border rounded-lg text-[10px] font-bold text-fg-muted hover:text-brand-400 hover:border-brand-500/40 transition-all whitespace-nowrap"
                                                    >
                                                        + {qEx}
                                                    </button>
                                                ))}
                                            </div>

                                            <button
                                                onClick={() => addExercise(activeIdx)}
                                                className="w-full py-4 border-2 border-dashed border-surface-border rounded-2xl flex items-center justify-center gap-3 text-sm font-bold text-fg-muted hover:text-brand-400 hover:border-brand-600/60 transition-all"
                                            >
                                                <Plus className="w-4 h-4 text-brand-400" />
                                                Add Custom Exercise
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="card p-20 text-center space-y-4">
                            <Calendar className="w-12 h-12 text-fg-subtle mx-auto mb-2" />
                            <h3 className="heading-3">No day selected</h3>
                            <button onClick={addWorkout} className="btn-primary">Add Your First Day</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
