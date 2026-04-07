"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Plus, Minus, Save, ChevronLeft, Dumbbell,
    Settings, Layout, Calendar, CheckCircle2,
    Trash2, ChevronRight, Copy, ChevronDown, ChevronUp, GripVertical, Loader2, CalendarRange, ArrowRight, ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_TEMPLATES } from "@/lib/templates";
import { ExerciseAutocomplete, isCardio } from "@/components/shared/ExerciseAutocomplete";

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
    dayOfWeek?: number | null; // 0=Mon, 1=Tue, ..., 6=Sun
    exercises: LocalExercise[];
}

interface LocalWeek {
    weekNumber: number;
    name?: string;
    workouts: LocalWorkout[];
}

export function PlanCreateClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const templateId = searchParams.get("template");
    const editId = searchParams.get("id");
    const clientId = searchParams.get("clientId");
    const isViewOnly = searchParams.get("view") === "true";

    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    
    // Changing state to support multiple weeks
    const [weeks, setWeeks] = useState<LocalWeek[]>([]);
    const [activeWeekIdx, setActiveWeekIdx] = useState(0);
    const [activeWorkoutIdx, setActiveWorkoutIdx] = useState(0);
    const [isLinearityMode, setIsLinearityMode] = useState(false);
    const [linearityStartWeekIdx, setLinearityStartWeekIdx] = useState(0);

    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastAddedExerciseIdx, setLastAddedExerciseIdx] = useState<number | null>(null);
    const [draggedWorkoutIdx, setDraggedWorkoutIdx] = useState<number | null>(null);

    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
                        
                        const mappedWeeks = data.weeks?.map((week: any) => ({
                            weekNumber: week.weekNumber,
                            name: week.name,
                            workouts: (week.workouts || []).map((w: any) => ({
                                name: w.name,
                                dayNumber: w.dayNumber,
                                dayOfWeek: w.dayOfWeek,
                                exercises: (w.exercises || []).map((e: any) => ({
                                    name: e.name,
                                    sets: e.sets,
                                    reps: e.reps,
                                    weightTargetKg: e.weightTargetKg,
                                    order: e.order
                                }))
                            }))
                        })) || [];

                        if (mappedWeeks.length > 0) {
                            setWeeks(mappedWeeks);
                        } else {
                            setWeeks([{ weekNumber: 1, workouts: [{ name: "Day 1", dayNumber: 1, dayOfWeek: 0, exercises: [] }] }]);
                        }
                    } else {
                        setError(data.error || "Failed to load plan details.");
                    }
                } catch (e) {
                    console.error("Failed to fetch plan:", e);
                    setError("Connection lost or server error.");
                } finally {
                    setLoading(false);
                }
            } else if (templateId && PLAN_TEMPLATES[templateId]) {
                const t = PLAN_TEMPLATES[templateId];
                setName(t.name);
                setDesc(t.description);
                setWeeks([{
                    weekNumber: 1,
                    workouts: t.workouts.map(w => ({
                        name: w.name,
                        dayNumber: w.dayNumber,
                        dayOfWeek: (w.dayNumber - 1) % 7, // 1=0(Mon), 2=1(Tue)...
                        exercises: w.exercises.map((e, idx) => ({ ...e, order: idx }))
                    }))
                }]);
            } else {
                setWeeks([{
                    weekNumber: 1,
                    workouts: [{ name: "Full Body A", dayNumber: 1, dayOfWeek: 0, exercises: [] }]
                }]);
            }
        };
        load();
    }, [templateId, editId]);

    const currentWeek = weeks[activeWeekIdx];
    const workouts = currentWeek?.workouts || [];

    const handleNextWeek = () => {
        if (activeWeekIdx < weeks.length - 1) {
            const nextWeek = weeks[activeWeekIdx + 1];
            setActiveWeekIdx(activeWeekIdx + 1);
            
            // Stay on the same day index if it exists in the next week
            if (activeWorkoutIdx >= nextWeek.workouts.length) {
                setActiveWorkoutIdx(0);
            }
        } else if (!isViewOnly) {
            // Clone the current week
            const newWeek: LocalWeek = {
                weekNumber: currentWeek.weekNumber + 1,
                name: `Week ${currentWeek.weekNumber + 1}`,
                workouts: currentWeek.workouts.map(w => ({
                    ...w,
                    exercises: w.exercises.map(e => ({ ...e }))
                })),
            };
            setWeeks([...weeks, newWeek]);
            setActiveWeekIdx(activeWeekIdx + 1);
            // Since we cloned, the workout index definitely exists
        }
    };

    const handlePrevWeek = () => {
        if (activeWeekIdx > 0) {
            const prevWeek = weeks[activeWeekIdx - 1];
            setActiveWeekIdx(activeWeekIdx - 1);
            
            // Stay on the same day index if it exists in the previous week
            if (activeWorkoutIdx >= prevWeek.workouts.length) {
                setActiveWorkoutIdx(0);
            }
        }
    };

    const handleDeleteWeek = () => {
        if (weeks.length <= 1) return alert("You must have at least one week in the plan.");
        if (!confirm("Are you sure you want to delete this entire week?")) return;
        
        const nextWeeks = weeks.filter((_, i) => i !== activeWeekIdx);
        // Renumber weeks
        nextWeeks.forEach((w, i) => w.weekNumber = i + 1);
        setWeeks(nextWeeks);
        setActiveWeekIdx(Math.max(0, activeWeekIdx - 1));
        setActiveWorkoutIdx(0);
    };

    const updateCurrentWorkouts = (newWorkouts: LocalWorkout[]) => {
        const nextWeeks = [...weeks];
        // Ensure they stay in order by day number or Day of Week if that's what the user wants
        const sorted = [...newWorkouts].map((w, i) => ({ ...w, dayNumber: i + 1 }));
        nextWeeks[activeWeekIdx].workouts = sorted;
        setWeeks(nextWeeks);
    };

    const handleWorkoutSort = (wIdx: number, newDayOfWeek: number) => {
        const next = [...workouts];
        const target = next[wIdx];
        target.dayOfWeek = newDayOfWeek;
        
        // Sort by day of week if multiple are assigned
        const sorted = next.sort((a,b) => {
            const aDay = a.dayOfWeek ?? 999;
            const bDay = b.dayOfWeek ?? 999;
            return aDay - bDay;
        }).map((w, i) => ({ ...w, dayNumber: i + 1 }));

        // Find the new index of the workout we just changed to keep focus
        const nextActiveIdx = sorted.findIndex(w => 
            w.name === target.name && 
            w.dayOfWeek === target.dayOfWeek && 
            JSON.stringify(w.exercises) === JSON.stringify(target.exercises)
        );
        updateCurrentWorkouts(sorted);
        if (nextActiveIdx !== -1) setActiveWorkoutIdx(nextActiveIdx);
    };

    const handleDragStart = (idx: number) => setDraggedWorkoutIdx(idx);
    const handleDragOver = (e: React.DragEvent) => e.preventDefault();
    const handleDrop = (targetIdx: number) => {
        if (draggedWorkoutIdx === null || draggedWorkoutIdx === targetIdx) return;
        
        const next = [...workouts];
        const [moved] = next.splice(draggedWorkoutIdx, 1);
        next.splice(targetIdx, 0, moved);
        
        // Update day numbers
        const final = next.map((w, i) => ({ ...w, dayNumber: i + 1 }));
        updateCurrentWorkouts(final);
        setActiveWorkoutIdx(targetIdx);
        setDraggedWorkoutIdx(null);
    };

    const addWorkout = () => {
        if (workouts.length >= 7) {
            alert("A week can have a maximum of 7 training days.");
            return;
        }
        const nextIdx = workouts.length;
        
        // Find next available day of week
        let nextDow = nextIdx % 7;
        const usedDows = workouts.map(w => w.dayOfWeek);
        for (let i = 0; i < 7; i++) {
            if (!usedDows.includes(i)) {
                nextDow = i;
                break;
            }
        }

        updateCurrentWorkouts([...workouts, {
            name: `Day ${nextIdx + 1}`,
            dayNumber: nextIdx + 1,
            dayOfWeek: nextDow,
            exercises: []
        }]);
        setActiveWorkoutIdx(nextIdx);
    };

    const removeWorkout = (idx: number) => {
        const next = workouts.filter((_, i) => i !== idx).map((w, i) => ({ ...w, dayNumber: i + 1 }));
        updateCurrentWorkouts(next);
        if (activeWorkoutIdx >= next.length) setActiveWorkoutIdx(Math.max(0, next.length - 1));
    };

    const duplicateWorkout = (idx: number) => {
        if (workouts.length >= 7) {
            alert("All 7 days are already in use. Remove a day before copying.");
            return;
        }
        const toDup = workouts[idx];
        const usedDows = workouts.map(w => w.dayOfWeek);
        let nextFreeDow: number | null = null;
        for (let i = 0; i < 7; i++) {
            if (!usedDows.includes(i)) { nextFreeDow = i; break; }
        }
        if (nextFreeDow === null) {
            alert("All 7 days are already assigned. Remove a day before copying.");
            return;
        }
        const next = [...workouts];
        next.splice(idx + 1, 0, {
            ...JSON.parse(JSON.stringify(toDup)),
            name: `${toDup.name} (Copy)`,
            dayNumber: idx + 2,
            dayOfWeek: nextFreeDow,
        });
        updateCurrentWorkouts(next.map((w, i) => ({ ...w, dayNumber: i + 1 })));
        setActiveWorkoutIdx(idx + 1);
    };

    const addExercise = (wIdx: number) => {
        const next = JSON.parse(JSON.stringify(weeks));
        const newIdx = next[0].workouts[wIdx]?.exercises.length ?? 0;
        next.forEach((w: any) => {
            if (w.workouts[wIdx]) {
                w.workouts[wIdx].exercises.push({ name: "", sets: 3, reps: "10", order: newIdx });
            }
        });
        setWeeks(next);
        setLastAddedExerciseIdx(newIdx);
    };

    const updateExercise = (wIdx: number, eIdx: number, updates: Partial<LocalExercise>) => {
        const next = JSON.parse(JSON.stringify(weeks));
        next[activeWeekIdx].workouts[wIdx].exercises[eIdx] = { ...next[activeWeekIdx].workouts[wIdx].exercises[eIdx], ...updates };
        
        // Propagate name changes to all weeks so Linearity Mode is consistent
        if (updates.name !== undefined) {
            next.forEach((w: any) => {
                if (w.workouts[wIdx]?.exercises[eIdx]) {
                    w.workouts[wIdx].exercises[eIdx].name = updates.name;
                }
            });
        }
        setWeeks(next);
    };

    const handleSubmit = async () => {
        if (!name) return alert("Give your plan a name!");
        setSaving(true);

        const payload = {
            name,
            description: desc,
            weeks: weeks.map(w => ({
                weekNumber: w.weekNumber,
                name: w.name,
                workouts: w.workouts.map(wd => ({
                    dayNumber: wd.dayNumber,
                    dayOfWeek: wd.dayOfWeek,
                    name: wd.name,
                    exercises: wd.exercises.filter(e => e.name.trim() !== "").map(e => ({
                        name: e.name,
                        sets: e.sets,
                        reps: e.reps,
                        weightTargetKg: e.weightTargetKg,
                        order: e.order
                    }))
                }))
            }))
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
                const savedPlan = await res.json();
                
                // If we have a clientId, auto-assign this plan to them
                if (clientId) {
                    await fetch("/api/coach/clients/plan", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ clientId, planId: savedPlan.id }),
                    });
                    router.push(`/coach/client/${clientId}`);
                } else {
                    router.push("/plans");
                }
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

    if (loading || !currentWeek) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
                <p className="text-fg-muted animate-pulse">Loading plan details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center">
                <div className="w-12 h-12 bg-danger-muted/10 flex items-center justify-center rounded-2xl mb-2">
                    <Trash2 className="w-6 h-6 text-danger/60" />
                </div>
                <h3 className="heading-3">Access Problem</h3>
                <p className="text-sm text-fg-muted max-w-xs">{error}</p>
                <button onClick={() => router.back()} className="btn-secondary mt-2">Go Back</button>
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
                        <h2 className="heading-2 text-lg sm:text-2xl">{isViewOnly ? "View Plan" : editId ? "Edit Plan" : "Plan Designer"}</h2>
                        <p className="text-xs text-brand-400 font-medium tracking-wide uppercase">
                            {isViewOnly ? "Read Only Mode" : templateId ? `${templateId.toUpperCase()} Template` : editId ? "Modifying Current Program" : "Custom Programme"}
                        </p>
                    </div>
                </div>
                {!isViewOnly && (
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsLinearityMode(!isLinearityMode)}
                            className={cn(
                                "btn-secondary h-10 px-4 gap-2",
                                isLinearityMode && "bg-brand-500/10 border-brand-500/50 text-brand-400"
                            )}
                        >
                            <CalendarRange className="w-4 h-4" />
                            <span className="hidden sm:inline">{isLinearityMode ? "Day Editor" : "Linearity Mode"}</span>
                        </button>
                        <button onClick={handleSubmit} disabled={saving} className="btn-primary shadow-glow-brand h-10 px-6">
                            <Save className="w-4 h-4" />
                            {saving ? "Saving..." : editId ? "Update" : "Done"}
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-4 order-2 lg:order-1">
                    <div className="card p-5 space-y-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="label">Plan Name</label>
                                <input
                                    type="text"
                                    className="input text-[16px] sm:text-sm font-bold"
                                    placeholder="e.g. Hypertrophy Phase"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    readOnly={isViewOnly}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="label">Focus / Notes</label>
                                <textarea
                                    className="input h-20 text-[16px] sm:text-xs py-3 resize-none"
                                    placeholder="Focus on progressive overload..."
                                    value={desc}
                                    onChange={(e) => setDesc(e.target.value)}
                                    readOnly={isViewOnly}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between mb-2">
                            <p className="label px-1 mb-0 flex-1">Training Calendar</p>
                        </div>
                        
                        {/* Week Navigator */}
                        <div className="card p-3 mb-4 flex flex-col gap-2 border-brand-500/30 shadow-glow-brand-sm bg-gradient-brand/5">
                            <div className="flex items-center justify-between">
                                <button 
                                    onClick={handlePrevWeek} 
                                    disabled={activeWeekIdx === 0}
                                    className="btn-icon w-8 h-8 rounded-lg disabled:opacity-30 border bg-surface-elevated hover:bg-white/10"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                                <div className="text-center">
                                    <p className="text-sm font-black text-fg uppercase tracking-widest">
                                        Week {currentWeek.weekNumber}
                                    </p>
                                    <p className="text-[9px] text-fg-muted uppercase tracking-widest font-bold">
                                        {workouts.length} Sessions
                                    </p>
                                </div>
                                <button 
                                    onClick={handleNextWeek} 
                                    className={cn(
                                        "btn-icon w-8 h-8 rounded-lg border",
                                        activeWeekIdx === weeks.length - 1 && !isViewOnly 
                                            ? "bg-brand-500/10 text-brand-400 border-brand-500/30 hover:bg-brand-500/20"
                                            : "bg-surface-elevated hover:bg-white/10 disabled:opacity-30"
                                    )}
                                    title={activeWeekIdx === weeks.length - 1 && !isViewOnly ? "Clone & Add Next Week" : "Next Week"}
                                    disabled={activeWeekIdx === weeks.length - 1 && isViewOnly}
                                >
                                    {activeWeekIdx === weeks.length - 1 && !isViewOnly ? <Plus className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                                </button>
                            </div>
                            {!isViewOnly && (
                                <button 
                                    onClick={handleDeleteWeek}
                                    className="w-full py-1.5 mt-1 text-[10px] uppercase tracking-widest font-bold text-danger/70 hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                                >
                                    Delete Week
                                </button>
                            )}
                        </div>

                        <div className="space-y-2">
                            {workouts.map((w, i) => (
                                <div
                                    key={i}
                                    draggable
                                    onDragStart={() => handleDragStart(i)}
                                    onDragOver={handleDragOver}
                                    onDrop={() => handleDrop(i)}
                                    className={cn(
                                        "relative group rounded-xl transition-all duration-300",
                                        draggedWorkoutIdx === i && "opacity-40 scale-95"
                                    )}
                                >
                                    <button
                                        onClick={() => setActiveWorkoutIdx(i)}
                                        className={cn(
                                            "w-full text-left flex items-center justify-between p-3 rounded-xl transition-all duration-200 border",
                                            activeWorkoutIdx === i 
                                                ? "bg-brand-950/40 border-brand-700/60 shadow-glow-sm" 
                                                : "bg-surface-card border-surface-border hover:bg-surface-muted"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="text-fg-subtle/30 cursor-grab active:cursor-grabbing hover:text-brand-400 group-hover:opacity-100 opacity-0 transition-opacity">
                                                <GripVertical className="w-4 h-4" />
                                            </div>
                                            <div className={cn("w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold",
                                                activeWorkoutIdx === i ? "bg-brand-400 text-white" : "bg-surface-elevated text-fg-subtle"
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
                                        {activeWorkoutIdx === i && <ChevronRight className="w-4 h-4 text-brand-400" />}
                                    </button>
                                </div>
                            ))}
                            {(!isViewOnly && workouts.length < 7) && (
                                <button
                                    onClick={addWorkout}
                                    className="w-full py-3 border-2 border-dashed border-surface-border rounded-xl text-xs font-bold text-fg-subtle hover:text-brand-400 hover:border-brand-600/40 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add New Day
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-8 order-1 lg:order-2">
                    {workouts[activeWorkoutIdx] ? (
                        isLinearityMode ? (
                            <div className="space-y-4 animate-slide-up">
                                <div className="card p-4 bg-surface-card border-brand-500/20 shadow-glow-brand-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h3 className="text-sm font-black text-fg uppercase tracking-widest">Linearity Matrix: {workouts[activeWorkoutIdx].name}</h3>
                                            <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest">Adjust variables across 4-week phases</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => setLinearityStartWeekIdx(Math.max(0, linearityStartWeekIdx - 1))}
                                                disabled={linearityStartWeekIdx === 0}
                                                className="btn-icon w-8 h-8 rounded-lg disabled:opacity-30 border"
                                            >
                                                <ArrowLeft className="w-3.5 h-3.5" />
                                            </button>
                                            <span className="text-[10px] font-black uppercase text-brand-400 min-w-[80px] text-center">
                                                Weeks {linearityStartWeekIdx + 1}-{Math.min(weeks.length, linearityStartWeekIdx + 4)}
                                            </span>
                                            <button 
                                                onClick={() => setLinearityStartWeekIdx(Math.min(weeks.length - 1, linearityStartWeekIdx + 1))}
                                                disabled={linearityStartWeekIdx + 1 >= weeks.length}
                                                className="btn-icon w-8 h-8 rounded-lg disabled:opacity-30 border"
                                            >
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto no-scrollbar -mx-4 px-4 pb-4">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr>
                                                    <th className="text-left p-3 text-[10px] font-black uppercase text-fg-subtle tracking-widest border-b border-surface-border w-1/4">Exercise</th>
                                                    {[0, 1, 2, 3].map(offset => {
                                                        const wIdx = linearityStartWeekIdx + offset;
                                                        if (wIdx >= weeks.length) return null;
                                                        return (
                                                            <th key={offset} className="text-center p-3 text-[10px] font-black uppercase text-brand-400 tracking-widest border-b border-surface-border">
                                                                W{wIdx + 1}
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {workouts[activeWorkoutIdx].exercises.map((templateEx, eIdx) => (
                                                    <tr key={eIdx} className="hover:bg-surface-elevated/30 transition-colors group">
                                                        <td className="p-3 border-b border-surface-border">
                                                            <p className="text-xs font-black text-fg mb-1">{templateEx.name || "Unnamed Exercise"}</p>
                                                            <p className="text-[9px] text-fg-muted font-bold uppercase tracking-tight italic">Position {eIdx + 1}</p>
                                                        </td>
                                                        {[0, 1, 2, 3].map(offset => {
                                                            const wIdx = linearityStartWeekIdx + offset;
                                                            if (wIdx >= weeks.length) return null;
                                                            const weekWorkout = weeks[wIdx].workouts[activeWorkoutIdx];
                                                            const ex = weekWorkout?.exercises[eIdx];

                                                            if (!ex) return <td key={offset} className="p-3 border-b border-surface-border text-center text-fg-subtle text-[9px] italic">N/A</td>;

                                                            return (
                                                                <td key={offset} className="p-3 border-b border-surface-border">
                                                                    <div className="space-y-1.5 min-w-[90px]">
                                                                        <div className="flex gap-1">
                                                                            <input 
                                                                                type="number" 
                                                                                className="w-full bg-surface-muted text-[16px] sm:text-[10px] font-black text-center p-1 rounded-md border border-surface-border outline-none focus:border-brand-500/40"
                                                                                value={ex.sets}
                                                                                placeholder="S"
                                                                                onChange={(e) => {
                                                                                    const next = JSON.parse(JSON.stringify(weeks));
                                                                                    next[wIdx].workouts[activeWorkoutIdx].exercises[eIdx].sets = parseInt(e.target.value) || 0;
                                                                                    setWeeks(next);
                                                                                }}
                                                                            />
                                                                            <input 
                                                                                type="text" 
                                                                                className="w-full bg-surface-muted text-[16px] sm:text-[10px] font-black text-center p-1 rounded-md border border-surface-border outline-none focus:border-brand-500/40"
                                                                                value={ex.reps}
                                                                                placeholder="R"
                                                                                onChange={(e) => {
                                                                                    const next = JSON.parse(JSON.stringify(weeks));
                                                                                    next[wIdx].workouts[activeWorkoutIdx].exercises[eIdx].reps = e.target.value;
                                                                                    setWeeks(next);
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <div className="relative">
                                                                            <input 
                                                                                type="number" 
                                                                                className="w-full bg-surface-elevated text-[16px] sm:text-[10px] font-black text-center p-1 rounded-md border border-brand-500/20 outline-none focus:border-brand-500/60 text-brand-400 font-mono"
                                                                                value={ex.weightTargetKg ?? ""}
                                                                                placeholder="KG"
                                                                                onChange={(e) => {
                                                                                    const next = JSON.parse(JSON.stringify(weeks));
                                                                                    const parsed = parseFloat(e.target.value);
                                                                                    next[wIdx].workouts[activeWorkoutIdx].exercises[eIdx].weightTargetKg = isNaN(parsed) ? undefined : parsed;
                                                                                    setWeeks(next);
                                                                                }}
                                                                            />
                                                                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[7px] text-fg-subtle font-black">KG</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Add Exercise in Linearity Mode */}
                                    <div className="mt-4 space-y-3">
                                        <div className="flex flex-wrap items-center gap-2 pb-1 px-1">
                                            <span className="text-[10px] font-bold text-fg-subtle uppercase whitespace-nowrap mr-1">Quick Add:</span>
                                            {["Bench Press", "Squat", "Deadlift", "Bicep Curls", "Lateral Raise", "Tricep Pushdown", "Lat Pulldown"].map(qEx => (
                                                <button
                                                    key={qEx}
                                                    onClick={() => {
                                                        const next = JSON.parse(JSON.stringify(weeks));
                                                        const newOrder = next[0].workouts[activeWorkoutIdx]?.exercises.length ?? 0;
                                                        // Add to ALL weeks so it appears as a full matrix row
                                                        next.forEach((w: any) => {
                                                            if (w.workouts[activeWorkoutIdx]) {
                                                                w.workouts[activeWorkoutIdx].exercises.push({ name: qEx, sets: 3, reps: "10", order: newOrder });
                                                            }
                                                        });
                                                        setWeeks(next);
                                                    }}
                                                    className="px-3 py-1 bg-surface-muted border border-surface-border rounded-lg text-[10px] font-bold text-fg-muted hover:text-brand-400 hover:border-brand-500/40 transition-all whitespace-nowrap"
                                                >
                                                    + {qEx}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => {
                                                const next = JSON.parse(JSON.stringify(weeks));
                                                const newOrder = next[0].workouts[activeWorkoutIdx]?.exercises.length ?? 0;
                                                // Add blank exercise to ALL weeks
                                                next.forEach((w: any) => {
                                                    if (w.workouts[activeWorkoutIdx]) {
                                                        w.workouts[activeWorkoutIdx].exercises.push({ name: "", sets: 3, reps: "10", order: newOrder });
                                                    }
                                                });
                                                setWeeks(next);
                                            }}
                                            className="w-full py-3 border-2 border-dashed border-surface-border rounded-2xl flex items-center justify-center gap-3 text-sm font-bold text-fg-muted hover:text-brand-400 hover:border-brand-600/60 transition-all"
                                        >
                                            <Plus className="w-4 h-4 text-brand-400" />
                                            Add Custom Exercise
                                        </button>
                                    </div>

                                    <div className="mt-4 p-4 rounded-xl bg-brand-500/5 border border-brand-500/10">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Settings className="w-3 h-3 text-brand-400" />
                                            <p className="text-[9px] font-black uppercase text-brand-400 tracking-widest">Coaching Tip</p>
                                        </div>
                                        <p className="text-[10px] text-fg-muted font-medium italic">Use this matrix to plot progressive volume. Increase Weight or Reps horizontally across W1-W4 to visualize the athlete&apos;s journey.</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-slide-up" key={activeWorkoutIdx}>
                                <div className="card p-4 flex items-center justify-between bg-gradient-to-r from-surface-card to-brand-950/20">
                                    <div className="flex items-center gap-4 flex-1">
                                         <div className="w-10 h-10 rounded-xl bg-brand-400/10 border border-brand-400/20 flex items-center justify-center">
                                             <Dumbbell className="w-5 h-5 text-brand-400" />
                                         </div>
                                         <div className="flex-1">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <label className="text-[10px] font-black text-brand-400 uppercase tracking-widest block">Day {workouts[activeWorkoutIdx].dayNumber}</label>
                                                <div className="flex gap-1 overflow-x-auto no-scrollbar">
                                                    {[0, 1, 2, 3, 4, 5, 6].map(d => {
                                                        const isUsed = workouts.some((w, idx) => idx !== activeWorkoutIdx && w.dayOfWeek === d);
                                                        return (
                                                            <button
                                                                key={d}
                                                                onClick={() => {
                                                                    if (isUsed) return alert(`${DAYS[d]} is already assigned in this week.`);
                                                                    handleWorkoutSort(activeWorkoutIdx, d);
                                                                }}
                                                                className={cn(
                                                                    "w-8 h-5 rounded text-[9px] font-black transition-all border shrink-0",
                                                                    workouts[activeWorkoutIdx].dayOfWeek === d
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
                                                value={workouts[activeWorkoutIdx].name}
                                                onChange={(e) => {
                                                    const next = [...workouts];
                                                    next[activeWorkoutIdx].name = e.target.value;
                                                    updateCurrentWorkouts(next);
                                                }}
                                                readOnly={isViewOnly}
                                            />
                                         </div>
                                    </div>
                                    {!isViewOnly && (
                                        <div className="flex items-center gap-1 ml-4">
                                            <button onClick={() => duplicateWorkout(activeWorkoutIdx)} className="btn-icon w-8 h-8 rounded-lg" title="Duplicate Day">
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => removeWorkout(activeWorkoutIdx)} className="btn-icon w-8 h-8 rounded-lg text-danger/60 hover:text-danger hover:bg-danger/10" title="Delete Day">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {workouts[activeWorkoutIdx].exercises.length === 0 ? (
                                        <div className="card p-12 text-center border-dashed border-2 bg-transparent">
                                            <p className="text-sm text-fg-subtle mb-4">No exercises added to this day yet.</p>
                                            {!isViewOnly && (
                                                <button onClick={() => addExercise(activeWorkoutIdx)} className="btn-primary btn-sm">
                                                    <Plus className="w-4 h-4" />
                                                    Add First Exercise
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            {workouts[activeWorkoutIdx].exercises.map((ex, eIdx) => (
                                                <div key={eIdx} className="card p-4 group flex items-start gap-4">
                                                    <div className="pt-2 text-fg-subtle flex flex-col items-center gap-1">
                                                        <span className="text-[10px] font-bold">{eIdx + 1}</span>
                                                    </div>
                                                    <div className="flex-1 grid grid-cols-12 gap-4">
                                                        <div className="col-span-12 sm:col-span-4 lg:col-span-4">
                                                            <label className="label-mini block text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1 px-1">Exercise Name</label>
                                                            {isViewOnly ? (
                                                                <div className="w-full bg-surface-muted border border-surface-border rounded-xl px-4 py-2 text-sm text-fg">{ex.name}</div>
                                                            ) : (
                                                                <ExerciseAutocomplete
                                                                    value={ex.name}
                                                                    onChange={(val) => {
                                                                        const nameChanged = val !== ex.name;
                                                                        updateExercise(activeWorkoutIdx, eIdx, nameChanged ? { name: val, reps: isCardio(val) ? "20" : ex.reps } : { name: val });
                                                                    }}
                                                                    className="w-full bg-surface-muted border border-surface-border rounded-xl px-4 py-2 text-[16px] sm:text-sm text-fg"
                                                                    autoFocus={lastAddedExerciseIdx === eIdx}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="col-span-4 sm:col-span-2">
                                                            <label className="label-mini block text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1 px-1">
                                                                {isCardio(ex.name) ? "Rounds" : "Sets"}
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="w-full bg-surface-muted border border-surface-border rounded-xl px-4 py-2 text-[16px] sm:text-sm text-fg text-center"
                                                                value={ex.sets}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (/^\d*$/.test(val)) {
                                                                        updateExercise(activeWorkoutIdx, eIdx, { sets: parseInt(val) || 0 });
                                                                    }
                                                                }}
                                                                readOnly={isViewOnly}
                                                            />
                                                        </div>
                                                        <div className="col-span-4 sm:col-span-2">
                                                            <label className="label-mini block text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1 px-1">
                                                                {isCardio(ex.name) ? "Mins" : "Reps"}
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder={isCardio(ex.name) ? "20" : "8-12"}
                                                                className="w-full bg-surface-muted border border-surface-border rounded-xl px-4 py-2 text-[16px] sm:text-sm text-fg text-center"
                                                                value={ex.reps}
                                                                onChange={(e) => updateExercise(activeWorkoutIdx, eIdx, { reps: e.target.value })}
                                                                readOnly={isViewOnly}
                                                            />
                                                        </div>
                                                        <div className="col-span-4 sm:col-span-3">
                                                            <label className="label-mini block text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1 px-1">
                                                                Weight (kg)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                placeholder="0"
                                                                className="w-full bg-surface-muted border border-surface-border rounded-xl px-4 py-2 text-[16px] sm:text-sm text-fg text-center"
                                                                value={ex.weightTargetKg || ""}
                                                                onChange={(e) => updateExercise(activeWorkoutIdx, eIdx, { weightTargetKg: parseFloat(e.target.value) || undefined })}
                                                                readOnly={isViewOnly}
                                                            />
                                                        </div>
                                                        {!isViewOnly && (
                                                            <div className="col-span-12 sm:col-span-1 flex items-end mt-2 sm:mt-0">
                                                                <button
                                                                    onClick={() => {
                                                                        const next = JSON.parse(JSON.stringify(weeks));
                                                                        next.forEach((w: any) => {
                                                                            if (w.workouts[activeWorkoutIdx]) {
                                                                                w.workouts[activeWorkoutIdx].exercises = w.workouts[activeWorkoutIdx].exercises.filter((_: any, i: number) => i !== eIdx);
                                                                                w.workouts[activeWorkoutIdx].exercises.forEach((ex: any, idx: number) => ex.order = idx);
                                                                            }
                                                                        });
                                                                        setWeeks(next);
                                                                    }}
                                                                    className="flex items-center justify-center w-full h-10 rounded-xl bg-danger-muted/5 text-danger/40 hover:text-danger hover:bg-danger-muted/20 transition-all"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                            {!isViewOnly && (
                                                <div className="space-y-3">
                                                    <div className="flex flex-wrap items-center gap-2 pb-1 px-1">
                                                        <span className="text-[10px] font-bold text-fg-subtle uppercase whitespace-nowrap mr-1">Quick Add:</span>
                                                        {["Bench Press", "Squat", "Deadlift", "Bicep Curls", "Lateral Raise", "Tricep Pushdown", "Lat Pulldown"].map(qEx => (
                                                            <button
                                                                key={qEx}
                                                                onClick={() => {
                                                                    const next = JSON.parse(JSON.stringify(weeks));
                                                                    const newOrder = next[0].workouts[activeWorkoutIdx]?.exercises.length ?? 0;
                                                                    next.forEach((w: any) => {
                                                                        if (w.workouts[activeWorkoutIdx]) {
                                                                            w.workouts[activeWorkoutIdx].exercises.push({ name: qEx, sets: 3, reps: "10", order: newOrder });
                                                                        }
                                                                    });
                                                                    setWeeks(next);
                                                                }}
                                                                className="px-3 py-1 bg-surface-muted border border-surface-border rounded-lg text-[10px] font-bold text-fg-muted hover:text-brand-400 hover:border-brand-500/40 transition-all whitespace-nowrap"
                                                            >
                                                                + {qEx}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <button
                                                        onClick={() => addExercise(activeWorkoutIdx)}
                                                        className="w-full py-4 border-2 border-dashed border-surface-border rounded-2xl flex items-center justify-center gap-3 text-sm font-bold text-fg-muted hover:text-brand-400 hover:border-brand-600/60 transition-all"
                                                    >
                                                        <Plus className="w-4 h-4 text-brand-400" />
                                                        Add Custom Exercise
                                                    </button>
                                                </div>
                                            )}
                                        </>

                                    )}
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="card p-20 text-center space-y-4">
                            <Calendar className="w-12 h-12 text-fg-subtle mx-auto mb-2" />
                            <h3 className="heading-3">No day selected</h3>
                            {!isViewOnly && <button onClick={addWorkout} className="btn-primary">Add Your First Day</button>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
