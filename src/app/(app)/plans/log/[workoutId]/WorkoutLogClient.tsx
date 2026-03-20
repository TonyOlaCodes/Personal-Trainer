"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    ChevronLeft, Timer, Flame, Check, HelpCircle,
    Trash2, Plus, Info, InfoIcon, Award
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Exercise {
    id: string;
    name: string;
    sets: number;
    reps: string;
    weightTargetKg?: number | null;
    notes?: string | null;
}

interface Workout {
    id: string;
    name: string;
    exercises: Exercise[];
}

interface SetLog {
    setNumber: number;
    reps: number;
    weightKg: string;
    isCompleted: boolean;
    isWarmup: boolean;
}

interface Props {
    workout: Workout;
}

export function WorkoutLogClient({ workout }: Props) {
    const router = useRouter();
    const [logs, setLogs] = useState<Record<string, SetLog[]>>({});
    const [startTime] = useState(Date.now());
    const [elapsed, setElapsed] = useState(0);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // Initialize logs from workout data or fetch existing IN_PROGRESS log
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch("/api/logs?active=true");
                const active = await res.json();
                
                if (active && active.workoutId === workout.id) {
                    const restored: Record<string, SetLog[]> = {};
                    workout.exercises.forEach(ex => restored[ex.id] = []);
                    
                    active.sets.forEach((s: any) => {
                        if (restored[s.exerciseId]) {
                            restored[s.exerciseId].push({
                                setNumber: s.setNumber,
                                reps: s.reps ?? 10,
                                weightKg: s.weightKg?.toString() ?? "",
                                isCompleted: s.isCompleted,
                                isWarmup: s.isWarmup,
                            });
                        }
                    });
                    setLogs(restored);
                } else {
                    const initialLogs: Record<string, SetLog[]> = {};
                    workout.exercises.forEach((ex) => {
                        initialLogs[ex.id] = Array.from({ length: ex.sets }, (_, i) => ({
                            setNumber: i + 1,
                            reps: parseInt(ex.reps) || 10,
                            weightKg: ex.weightTargetKg?.toString() || "",
                            isCompleted: false,
                            isWarmup: false,
                        }));
                    });
                    setLogs(initialLogs);
                }
            } catch (e) {
                console.error("Failed to load active log:", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [workout]);

    // Timer
    useEffect(() => {
        const timer = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [startTime]);

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const saveProgress = async (currentLogs: Record<string, SetLog[]>) => {
        const flattenedSets = Object.entries(currentLogs).flatMap(([exId, sets]) =>
            sets.map(s => ({
                exerciseId: exId,
                setNumber: s.setNumber,
                reps: s.reps,
                weightKg: s.weightKg ? parseFloat(s.weightKg) : undefined,
                isWarmup: s.isWarmup,
                isCompleted: s.isCompleted,
            }))
        );

        try {
            await fetch("/api/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workoutId: workout.id,
                    status: "IN_PROGRESS",
                    sets: flattenedSets,
                }),
            });
        } catch (e) {
            console.error("Auto-save failed:", e);
        }
    };

    const updateSet = (exId: string, setIdx: number, updates: Partial<SetLog>) => {
        setLogs((prev) => {
            const next = {
                ...prev,
                [exId]: prev[exId].map((set, i) => i === setIdx ? { ...set, ...updates } : set),
            };
            if (Object.keys(updates).some(k => ["isCompleted", "weightKg", "reps"].includes(k))) {
                saveProgress(next);
            }
            return next;
        });
    };

    const addSet = (exId: string) => {
        setLogs((prev) => {
            const sets = prev[exId] || [];
            const lastSet = sets[sets.length - 1];
            const next = {
                ...prev,
                [exId]: [
                    ...sets,
                    {
                        setNumber: sets.length + 1,
                        reps: lastSet?.reps || 10,
                        weightKg: lastSet?.weightKg || "",
                        isCompleted: false,
                        isWarmup: false,
                    },
                ],
            };
            saveProgress(next);
            return next;
        });
    };

    const removeSet = (exId: string, setIdx: number) => {
        setLogs((prev) => {
            const next = {
                ...prev,
                [exId]: prev[exId].filter((_, i) => i !== setIdx).map((s, i) => ({ ...s, setNumber: i + 1 })),
            };
            saveProgress(next);
            return next;
        });
    };

    const handleSubmit = async () => {
        setSaving(true);
        const flattenedSets = Object.entries(logs).flatMap(([exId, sets]) =>
            // Keep all sets but status reflects completion
            sets.map(s => ({
                exerciseId: exId,
                setNumber: s.setNumber,
                reps: s.reps || undefined,
                weightKg: s.weightKg ? parseFloat(s.weightKg) : undefined,
                isWarmup: s.isWarmup,
                isCompleted: s.isCompleted,
            }))
        );

        if (!flattenedSets.some(s => s.isCompleted)) {
            alert("Finish at least one set!");
            setSaving(false);
            return;
        }

        try {
            const res = await fetch("/api/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workoutId: workout.id,
                    duration: Math.floor(elapsed / 60),
                    status: "COMPLETED",
                    sets: flattenedSets,
                }),
            });
            if (res.ok) router.push("/dashboard");
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center pt-safe-area">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-fg-subtle text-sm">Resuming session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface flex flex-col pt-safe-area">
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-16 border-b border-surface-border glass fixed top-0 inset-x-0 z-40 lg:pl-[var(--sidebar-width)]">
                <button onClick={() => router.back()} className="btn-icon">
                    <ChevronLeft className="w-5 h-5 text-fg-muted" />
                </button>
                <div className="text-center">
                    <h2 className="text-sm font-bold text-fg truncate max-w-[180px]">{workout.name}</h2>
                    <div className="flex items-center justify-center gap-1 text-[10px] text-brand-400 font-semibold uppercase tracking-widest">
                        <Timer className="w-3 h-3" />
                        {formatTime(elapsed)}
                    </div>
                </div>
                <button onClick={handleSubmit} disabled={saving} className="btn-primary btn-sm px-4 shadow-glow-brand">
                    Finish
                </button>
            </div>

            <div className="flex-1 p-4 pt-20 pb-24 overflow-y-auto no-scrollbar lg:pl-[var(--sidebar-width) + 1rem]">
                <div className="max-w-2xl mx-auto space-y-6">
                    {workout.exercises.map((ex) => (
                        <div key={ex.id} className="card p-4 space-y-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-bold text-fg text-base">{ex.name}</h3>
                                    {ex.notes && <p className="text-xs text-fg-muted mt-0.5">{ex.notes}</p>}
                                </div>
                                <button className="text-fg-subtle p-1 hover:text-fg transition-colors">
                                    <InfoIcon className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-2">
                                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-fg-subtle uppercase px-2 mb-1">
                                    <div className="col-span-1 text-center">Set</div>
                                    <div className="col-span-4 text-center">Weight</div>
                                    <div className="col-span-4 text-center">Reps</div>
                                    <div className="col-span-3 text-center">Check</div>
                                </div>

                                {logs[ex.id]?.map((set, sIdx) => (
                                    <div
                                        key={sIdx}
                                        className={cn(
                                            "grid grid-cols-12 gap-2 p-1.5 rounded-xl border transition-all duration-200",
                                            set.isCompleted
                                                ? "bg-success-950/20 border-success-800/40"
                                                : "bg-surface-muted/50 border-surface-border hover:border-brand-700/30"
                                        )}
                                    >
                                        <div className="col-span-1 flex items-center justify-center">
                                            <button
                                                onClick={() => updateSet(ex.id, sIdx, { isWarmup: !set.isWarmup })}
                                                className={cn(
                                                    "w-6 h-6 rounded-md text-[10px] font-bold flex items-center justify-center transition-colors",
                                                    set.isWarmup ? "bg-warning-500/20 text-warning-400" : "bg-surface-elevated text-fg-subtle hover:text-fg"
                                                )}
                                            >
                                                {set.isWarmup ? "W" : set.setNumber}
                                            </button>
                                        </div>

                                        <div className="col-span-4">
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    className="input-sm w-full bg-surface-elevated border-none focus:ring-1 focus:ring-brand-500 text-center text-sm font-semibold rounded-lg h-9"
                                                    value={set.weightKg}
                                                    onChange={(e) => updateSet(ex.id, sIdx, { weightKg: e.target.value })}
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-fg-subtle pointer-events-none">kg</span>
                                            </div>
                                        </div>

                                        <div className="col-span-4">
                                            <input
                                                type="number"
                                                className="input-sm w-full bg-surface-elevated border-none focus:ring-1 focus:ring-brand-500 text-center text-sm font-semibold rounded-lg h-9"
                                                value={set.reps}
                                                onChange={(e) => updateSet(ex.id, sIdx, { reps: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>

                                        <div className="col-span-3 flex items-center gap-1">
                                            <button
                                                onClick={() => updateSet(ex.id, sIdx, { isCompleted: !set.isCompleted })}
                                                className={cn(
                                                    "flex-1 h-9 rounded-lg flex items-center justify-center transition-all",
                                                    set.isCompleted
                                                        ? "bg-success text-white shadow-glow-success"
                                                        : "bg-surface-elevated text-fg-muted hover:bg-brand-950/20 hover:text-brand-400"
                                                )}
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => removeSet(ex.id, sIdx)}
                                                className="w-8 h-9 rounded-lg flex items-center justify-center text-danger/40 hover:text-danger hover:bg-danger-950/20 transition-all"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => addSet(ex.id)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-surface-muted/50 border border-dashed border-surface-border rounded-xl text-xs font-semibold text-fg-muted hover:text-brand-400 hover:border-brand-600 transition-all"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Set
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="fixed bottom-0 inset-x-0 p-4 bg-surface p-safe-area lg:hidden border-t border-surface-border glass">
                <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="btn-primary w-full h-12 text-base shadow-glow-brand"
                >
                    {saving ? "Signing off..." : "Finish Workout"}
                </button>
            </div>
        </div>
    );
}
