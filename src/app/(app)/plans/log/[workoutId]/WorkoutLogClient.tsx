"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    ChevronLeft, Timer, Flame, Check, HelpCircle,
    Trash2, Plus, Info, InfoIcon, Award, Video, Play, Zap
} from "lucide-react";
import { cn, generateId } from "@/lib/utils";
import { isCardio, ExerciseAutocomplete } from "@/components/shared/ExerciseAutocomplete";

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
    rpe: string;
    isCompleted: boolean;
    isWarmup: boolean;
    videoUrl?: string;
    isUploading?: boolean;
}

interface Props {
    workout: Workout;
    tutorialUrls?: Record<string, string>;
    logDate?: string; // ISO date string for retroactive logging (e.g. "2026-03-25")
}

export function WorkoutLogClient({ workout, tutorialUrls = {}, logDate }: Props) {
    const router = useRouter();
    const [logs, setLogs] = useState<Record<string, SetLog[]>>({});
    const [startTime, setStartTime] = useState(Date.now());
    const [elapsed, setElapsed] = useState(0);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const [showFinishModal, setShowFinishModal] = useState(false);
    const [manualDurationMinutes, setManualDurationMinutes] = useState("");
    const [workoutNotes, setWorkoutNotes] = useState("");

    // Active exercises state (allows adding/substituting)
    const [activeExercises, setActiveExercises] = useState<Exercise[]>(workout.exercises);
    const [isSubstituting, setIsSubstituting] = useState<string | null>(null); // exerciseId
    const [isAddingExercise, setIsAddingExercise] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeLogId, setActiveLogId] = useState<string | null>(null);
    const [isDiscarding, setIsDiscarding] = useState(false);

    // Initialize logs from workout data or fetch existing IN_PROGRESS log
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch("/api/logs?active=true");
                const active = await res.json();
                
                if (active && active.workoutId === workout.id) {
                    setActiveLogId(active.id);
                    const restored: Record<string, SetLog[]> = {};
                    workout.exercises.forEach(ex => restored[ex.id] = []);
                    
                    if (active.duration) {
                        setStartTime(Date.now() - (active.duration * 60000));
                    } else if (active.loggedAt) {
                        setStartTime(new Date(active.loggedAt).getTime());
                    }

                    active.sets.forEach((s: any) => {
                        if (restored[s.exerciseId]) {
                            restored[s.exerciseId].push({
                                setNumber: s.setNumber,
                                reps: s.reps ?? 10,
                                weightKg: s.weightKg?.toString() ?? "",
                                rpe: s.rpe?.toString() ?? "",
                                isCompleted: s.isCompleted,
                                isWarmup: s.isWarmup,
                                videoUrl: s.videoUrl,
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
                            rpe: "",
                            isCompleted: false,
                            isWarmup: false,
                        }));
                    });
                    setLogs(initialLogs);
                    // Crucial: Save immediately to lock in the start time (loggedAt) in the DB
                    // This prevents the timer from resetting if the user navigates away and back
                    saveProgress(initialLogs, workout.exercises);
                }
            } catch (e) {
                console.error("Failed to load active log:", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [workout]);

    // Handle potential updates to activeExercises from DB
    useEffect(() => {
        const fetchActiveLog = async () => {
            try {
                const res = await fetch("/api/logs?active=true");
                const active = await res.json();
                if (active && active.workoutId === workout.id) {
                    // If we have custom exercises saved in the log (not in the original workout)
                    // we should ideally reconstruct them from the sets.
                    // But for now, let's assume we just need to ensure logs has entries for everything in activeExercises.
                }
            } catch {}
        };
        // fetchActiveLog();
    }, []);

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

    const saveProgress = async (currentLogs: Record<string, SetLog[]>, currentExercises?: Exercise[]) => {
        const exList = currentExercises || activeExercises;
        const flattenedSets = Object.entries(currentLogs).flatMap(([exId, sets]) => {
            const exInfo = exList.find(e => e.id === exId);
            return sets.map(s => ({
                exerciseId: exId,
                exerciseName: exInfo?.name || "Unknown", // Pass name in case it's a new or substituted exercise
                setNumber: s.setNumber,
                reps: s.reps,
                weightKg: s.weightKg ? parseFloat(s.weightKg) : undefined,
                rpe: s.rpe ? parseInt(s.rpe) : undefined,
                isWarmup: s.isWarmup,
                isCompleted: s.isCompleted,
                videoUrl: s.videoUrl || undefined,
            }));
        });

        try {
            const res = await fetch("/api/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workoutId: workout.id,
                    status: "IN_PROGRESS",
                    ...(logDate ? { loggedAt: new Date(logDate).toISOString() } : {}),
                    sets: flattenedSets,
                }),
            });
            if (res.ok) {
                const saved = await res.json();
                if (saved.id) setActiveLogId(saved.id);
            }
        } catch (e) {
            console.error("Auto-save failed:", e);
        }
    };

    const updateSet = (exId: string, setIdx: number, updates: Partial<SetLog>) => {
        setLogs((prev) => {
            const currentSet = prev[exId][setIdx];
            
            // Auto-check logic: if weight is entered and it's not currently completed, check it
            let finalUpdates = { ...updates };
            if (updates.weightKg && updates.weightKg.trim() !== "" && !currentSet.isCompleted && updates.isCompleted === undefined) {
                finalUpdates.isCompleted = true;
            }

            const next = {
                ...prev,
                [exId]: prev[exId].map((set, i) => i === setIdx ? { ...set, ...finalUpdates } : set),
            };
            if (Object.keys(finalUpdates).some(k => ["isCompleted", "weightKg", "reps", "rpe", "videoUrl"].includes(k))) {
                saveProgress(next);
            }
            return next;
        });
    };

    const handleUploadVideo = async (exId: string, setIdx: number, file: File | undefined) => {
        if (!file) return;
        try {
            updateSet(exId, setIdx, { isUploading: true });
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            
            if (res.ok) {
                const { url } = await res.json();
                updateSet(exId, setIdx, { videoUrl: url, isUploading: false });
            } else {
                updateSet(exId, setIdx, { isUploading: false });
                alert("Upload failed.");
            }
        } catch(e) {
            console.error(e);
            updateSet(exId, setIdx, { isUploading: false });
            alert("Error uploading video.");
        }
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
                        rpe: lastSet?.rpe || "",
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

    const handleReplace = (newName: string) => {
        if (!isSubstituting || !newName) return;
        
        const newExId = `${isSubstituting}:sub:${generateId(4)}`;
        
        setActiveExercises(prev => prev.map(ex => 
            ex.id === isSubstituting ? { ...ex, id: newExId, name: newName } : ex
        ));
        
        setLogs(prev => {
            const next = { ...prev };
            if (next[isSubstituting]) {
                next[newExId] = next[isSubstituting];
                delete next[isSubstituting];
            }
            saveProgress(next, activeExercises.map(ex => ex.id === isSubstituting ? { ...ex, name: newName, id: newExId } : ex));
            return next;
        });
        
        setIsSubstituting(null);
        setSearchQuery("");
    };

    const handleAddExercise = (newName: string) => {
        if (!newName) return;
        
        const newEx: Exercise = {
            id: `new-${generateId()}`,
            name: newName,
            sets: 3,
            reps: "10",
        };

        setActiveExercises(prev => [...prev, newEx]);
        setLogs(prev => {
            const next = {
                ...prev,
                [newEx.id]: Array.from({ length: 3 }, (_, i) => ({
                    setNumber: i + 1,
                    reps: 10,
                    weightKg: "",
                    rpe: "",
                    isCompleted: false,
                    isWarmup: false,
                })),
            };
            saveProgress(next, [...activeExercises, newEx]);
            return next;
        });

        setIsAddingExercise(false);
        setSearchQuery("");
    };

    const handleInitiateFinish = () => {
        const flattenedSets = Object.entries(logs).flatMap(([exId, sets]) =>
            sets.map(s => ({ ...s, exerciseId: exId }))
        );
        if (!flattenedSets.some(s => s.isCompleted)) {
            alert("Finish at least one set!");
            return;
        }
        setManualDurationMinutes(Math.floor(elapsed / 60).toString());
        setShowFinishModal(true);
    };

    const handleSubmit = async () => {
        setSaving(true);
        const flattenedSets = Object.entries(logs).flatMap(([exId, sets]) =>
            sets.map(s => ({
                exerciseId: exId,
                setNumber: s.setNumber,
                reps: s.reps || undefined,
                weightKg: s.weightKg ? parseFloat(s.weightKg) : undefined,
                rpe: s.rpe ? parseInt(s.rpe) : undefined,
                isWarmup: s.isWarmup,
                isCompleted: s.isCompleted,
                videoUrl: s.videoUrl || undefined,
            }))
        );

        try {
            const finalDuration = parseInt(manualDurationMinutes) || Math.floor(elapsed / 60);
            const res = await fetch("/api/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workoutId: workout.id,
                    duration: finalDuration,
                    notes: workoutNotes.trim() || undefined,
                    status: "COMPLETED",
                    loggedAt: logDate ? new Date(logDate).toISOString() : undefined,
                    sets: flattenedSets,
                }),
            });
            
            if (res.ok) {
                setShowFinishModal(false);
                router.push("/dashboard");
                router.refresh();
            } else {
                const errData = await res.json();
                console.error("Save failed:", errData);
                alert(`Failed to save: ${errData.error?.message || JSON.stringify(errData.error) || "Unknown error"}`);
            }
        } catch (err) {
            console.error(err);
            alert("Connection error while saving session.");
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = async () => {
        if (!activeLogId) {
            router.back();
            return;
        }

        if (!confirm("Discard this session? All progress for this specific session will be permanently deleted.")) return;
        
        setIsDiscarding(true);
        try {
            const res = await fetch(`/api/logs/${activeLogId}`, { method: "DELETE" });
            if (res.ok) {
                router.push("/dashboard");
                router.refresh();
            }
        } catch (e) {
            console.error(e);
            alert("Failed to discard session.");
        } finally {
            setIsDiscarding(false);
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
                <button 
                    onClick={handleDiscard} 
                    disabled={isDiscarding}
                    className="btn-icon text-danger/60 hover:text-danger hover:bg-danger/10"
                    title="Discard Workout"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
                <div className="text-center">
                    <h2 className="text-sm font-bold text-fg truncate max-w-[180px]">{workout.name}</h2>
                    <div className="flex items-center justify-center gap-1 text-[10px] text-brand-400 font-semibold uppercase tracking-widest">
                        <Timer className="w-3 h-3" />
                        {formatTime(elapsed)}
                    </div>
                </div>
                <button onClick={handleInitiateFinish} disabled={saving} className="btn-primary btn-sm px-4 shadow-glow-brand">
                    Finish
                </button>
            </div>

            <div className="flex-1 p-4 pt-20 pb-24 overflow-y-auto no-scrollbar lg:pl-[var(--sidebar-width) + 1rem]">
                <div className="max-w-2xl mx-auto space-y-6">
                    {activeExercises.map((ex) => (
                        <div key={ex.id} id={`exercise-${ex.id}`} className="card p-4 space-y-4 animate-slide-up">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-fg text-base">{ex.name}</h3>
                                        <button 
                                            onClick={() => setIsSubstituting(ex.id)}
                                            className="text-[10px] font-black uppercase text-brand-400/60 hover:text-brand-400 bg-brand-400/5 hover:bg-brand-400/10 px-2 py-0.5 rounded-md transition-all flex items-center gap-1"
                                        >
                                            <Flame className="w-2.5 h-2.5" /> Swap
                                        </button>
                                    </div>
                                    {ex.notes && <p className="text-xs text-fg-muted mt-0.5">{ex.notes}</p>}
                                </div>
                                {tutorialUrls[ex.name] ? (
                                    <a
                                        href={tutorialUrls[ex.name]}
                                        target="_blank"
                                        className="btn-secondary btn-sm flex items-center gap-1.5 text-[10px] uppercase font-black text-brand-400 border-brand-500/20 hover:bg-brand-500 hover:text-white transition-colors"
                                    >
                                        <Play className="w-3 h-3 fill-current" /> Tutorial
                                    </a>
                                ) : (
                                    <button className="text-fg-subtle p-1 hover:text-fg transition-colors">
                                        <InfoIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-fg-subtle uppercase px-2 mb-1">
                                    <div className="col-span-1 text-center">{isCardio(ex.name) ? "Rd" : "Set"}</div>
                                    <div className="col-span-3 text-center">{isCardio(ex.name) ? "Lvl/Spd" : "Weight"}</div>
                                    <div className="col-span-3 text-center">{isCardio(ex.name) ? "Mins" : "Reps"}</div>
                                    <div className="col-span-2 text-center">RPE</div>
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

                                        <div className="col-span-3">
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    className="input-sm w-full bg-surface-elevated border-none focus:ring-1 focus:ring-brand-500 text-center text-sm font-semibold rounded-lg h-9"
                                                    value={set.weightKg}
                                                    onChange={(e) => updateSet(ex.id, sIdx, { weightKg: e.target.value })}
                                                />
                                                {!isCardio(ex.name) && (
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-fg-subtle pointer-events-none">kg</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="col-span-3">
                                            <input
                                                type="number"
                                                className="input-sm w-full bg-surface-elevated border-none focus:ring-1 focus:ring-brand-500 text-center text-sm font-semibold rounded-lg h-9"
                                                value={set.reps}
                                                onChange={(e) => updateSet(ex.id, sIdx, { reps: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                className="input-sm w-full bg-surface-elevated border-none focus:ring-1 focus:ring-brand-500 text-center text-sm font-semibold rounded-lg h-9"
                                                value={set.rpe}
                                                placeholder="1-10"
                                                onChange={(e) => updateSet(ex.id, sIdx, { rpe: e.target.value })}
                                            />
                                        </div>

                                        <div className="col-span-3 flex items-center justify-end gap-1">
                                            <label className="cursor-pointer">
                                                <input 
                                                    type="file" 
                                                    accept="video/*" 
                                                    className="hidden" 
                                                    onChange={(e) => handleUploadVideo(ex.id, sIdx, e.target.files?.[0])}
                                                />
                                                <div className={cn(
                                                    "w-8 h-9 rounded-lg flex items-center justify-center transition-all",
                                                    set.isUploading ? "animate-pulse bg-brand-500/20 text-brand-400" :
                                                    set.videoUrl ? "bg-brand-500/20 text-brand-400" : "bg-surface-elevated text-fg-muted hover:bg-brand-950/20 hover:text-brand-400"
                                                )}>
                                                    <Video className="w-3.5 h-3.5" />
                                                </div>
                                            </label>
                                            <button
                                                onClick={() => updateSet(ex.id, sIdx, { isCompleted: !set.isCompleted })}
                                                className={cn(
                                                    "w-8 h-9 rounded-lg flex items-center justify-center transition-all",
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

                    <button
                        onClick={() => setIsAddingExercise(true)}
                        className="w-full h-16 rounded-3xl border-2 border-dashed border-surface-border text-fg-subtle hover:text-brand-400 hover:border-brand-500/40 hover:bg-brand-500/5 transition-all flex items-center justify-center gap-3 group"
                    >
                        <div className="w-8 h-8 rounded-xl bg-surface-muted flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
                            <Plus className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Add Exercise</span>
                    </button>
                    
                    <div className="mt-16 pb-32 text-center space-y-6 max-w-sm mx-auto animate-fade-in delay-500">
                        <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-brand-500/50 to-transparent mx-auto mb-10" />
                        <div className="space-y-2">
                             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-400 animate-pulse-slow">Mission: Complete</p>
                             <p className="text-[9px] font-bold text-fg-subtle uppercase tracking-widest leading-relaxed">Ensure all sets are checked before final verification</p>
                        </div>
                        <button
                            onClick={handleInitiateFinish}
                            className="btn-primary w-full h-16 text-lg font-black uppercase tracking-widest shadow-glow-brand group relative overflow-hidden flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
                        >
                            <Zap className="w-5 h-5 text-brand-300 group-hover:text-white group-hover:animate-bounce" />
                            Finish Workout
                        </button>
                    </div>
                </div>
            </div>

            {/* Substitution / Add Modal */}
            {(isSubstituting || isAddingExercise) && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 animate-fade-in p-4 backdrop-blur-sm">
                    <div className="bg-surface-card w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 animate-slide-up border border-surface-border shadow-glow-brand-lg">
                        <div className="text-center space-y-2">
                             <div className="w-16 h-16 bg-gradient-brand rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-glow-brand animate-pulse-brand">
                                <Plus className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-2xl font-black text-fg tracking-tighter uppercase whitespace-pre-wrap">
                                {isSubstituting ? "Substitute\nExercise" : "Add New\nExercise"}
                            </h3>
                            <p className="text-xs text-fg-subtle font-medium">Search for an exercise to replace or add.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-fg-subtle px-1">Search Exercises</label>
                                <ExerciseAutocomplete 
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                    autoFocus
                                    className="input h-14 font-bold border-brand-500/20 focus:border-brand-500"
                                    placeholder="Search e.g. Bench Press..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => {
                                    setIsSubstituting(null);
                                    setIsAddingExercise(false);
                                    setSearchQuery("");
                                }} 
                                className="btn-secondary h-12 flex-1"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => isSubstituting ? handleReplace(searchQuery) : handleAddExercise(searchQuery)}
                                disabled={!searchQuery.trim()} 
                                className="btn-primary h-12 flex-[2] shadow-glow-brand"
                            >
                                {isSubstituting ? "Replace" : "Add"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="fixed bottom-0 inset-x-0 p-4 bg-surface p-safe-area lg:hidden border-t border-surface-border glass">
                <button
                    onClick={handleInitiateFinish}
                    className="btn-primary w-full h-12 text-base shadow-glow-brand"
                >
                    Finish Workout
                </button>
            </div>

            {showFinishModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 animate-fade-in p-4">
                    <div className="bg-surface-card w-full max-w-sm rounded-[2rem] p-6 space-y-6 animate-slide-up border border-surface-border">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center mx-auto mb-2 shadow-glow-brand-sm">
                                <Award className="w-8 h-8 text-brand-400" />
                            </div>
                            <h3 className="text-2xl font-black text-fg tracking-tighter uppercase">Workout Complete!</h3>
                            <p className="text-xs text-fg-subtle font-medium">Review your session details below.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-fg-subtle px-1">Duration (Minutes)</label>
                                <div className="relative">
                                    <Timer className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-muted" />
                                    <input
                                        type="number"
                                        className="input pl-12 h-12 text-lg font-bold"
                                        value={manualDurationMinutes}
                                        onChange={(e) => setManualDurationMinutes(e.target.value)}
                                        placeholder="e.g. 45"
                                    />
                                    <p className="text-[9px] text-fg-subtle mt-1 px-1">Adjust if you forgot to end the timer</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-fg-subtle px-1">Notes (Optional)</label>
                                <textarea
                                    className="input h-20 text-sm py-3 resize-none"
                                    placeholder="Felt great, hit a PR on bench..."
                                    value={workoutNotes}
                                    onChange={(e) => setWorkoutNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setShowFinishModal(false)} className="btn-secondary h-12 flex-1" disabled={saving}>
                                Back
                            </button>
                            <button onClick={handleSubmit} className="btn-primary h-12 flex-[2] shadow-glow-brand" disabled={saving}>
                                {saving ? "Saving..." : "Save Session"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
