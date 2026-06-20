"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Timer, Flame, Check, HelpCircle,
    Trash2, Plus, InfoIcon, Award, Video, Play, Zap, X, ChevronLeft
} from "lucide-react";
import { cn, generateId, formatDate, isSameCalendarDay, parseLogDate, toDateKey, toLoggedAtIso } from "@/lib/utils";
import { appendReturnTo, getReturnToFromSearchParams } from "@/lib/navigation";
import { isCardio, ExerciseAutocomplete } from "@/components/shared/ExerciseAutocomplete";

interface Exercise {
    id: string;
    name: string;
    sets: number;
    reps: string;
    weightTargetKg?: number | null;
    notes?: string | null;
    order?: number;
    muscleGroup?: string | null;
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

interface ActiveLogSet {
    exerciseId: string;
    exercise?: Exercise | null;
    setNumber: number;
    reps?: number | null;
    weightKg?: number | null;
    rpe?: number | null;
    isCompleted?: boolean | null;
    isWarmup?: boolean | null;
    videoUrl?: string | null;
}

function buildInitialLogs(exercises: Exercise[]): Record<string, SetLog[]> {
    const initialLogs: Record<string, SetLog[]> = {};
    exercises.forEach((ex) => {
        initialLogs[ex.id] = Array.from({ length: ex.sets }, (_, i) => ({
            setNumber: i + 1,
            reps: parseInt(ex.reps, 10) || 10,
            weightKg: "",
            rpe: "",
            isCompleted: false,
            isWarmup: false,
        }));
    });
    return initialLogs;
}

interface InitialActiveLog {
    id: string;
    loggedAt: string;
    duration?: number | null;
    sets: ActiveLogSet[];
}

function restoreSessionState(
    active: InitialActiveLog,
    fallbackExercises: Exercise[],
    localStorageKey: string
) {
    const restored: Record<string, SetLog[]> = {};
    const reconstructedExercises: Exercise[] = [];

    active.sets.forEach((s) => {
        const ex = s.exercise;
        if (ex && !reconstructedExercises.some((e) => e.id === ex.id)) {
            reconstructedExercises.push({
                id: ex.id,
                name: ex.name,
                sets: ex.sets || 1,
                reps: ex.reps || "10",
                weightTargetKg: ex.weightTargetKg,
                notes: ex.notes,
                order: ex.order ?? 0,
                muscleGroup: ex.muscleGroup ?? null,
            });
        }

        if (!restored[s.exerciseId]) restored[s.exerciseId] = [];
        restored[s.exerciseId].push({
            setNumber: s.setNumber,
            reps: s.reps ?? 10,
            weightKg: s.weightKg?.toString() ?? "",
            rpe: s.rpe?.toString() ?? "",
            isCompleted: s.isCompleted ?? true,
            isWarmup: s.isWarmup ?? false,
            videoUrl: s.videoUrl ?? undefined,
        });
    });

    reconstructedExercises.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    let startTime = Date.now();
    if (active.duration) {
        startTime = Date.now() - active.duration * 60000;
    } else if (active.loggedAt) {
        startTime = new Date(active.loggedAt).getTime();
    }

    if (typeof window !== "undefined") {
        localStorage.setItem(localStorageKey, startTime.toString());
    }

    return {
        logs: Object.keys(restored).length > 0 ? restored : buildInitialLogs(fallbackExercises),
        exercises: reconstructedExercises.length > 0 ? reconstructedExercises : fallbackExercises,
        startTime,
        activeLogId: active.id,
    };
}

interface Props {
    workout: Workout;
    exerciseMedia?: Record<string, ExercisePreviewMedia>;
    logDate?: string;
    lastWorkoutLogSets?: Array<{ exerciseName: string; setNumber: number; weightKg: number | null }>;
    initialActiveLog?: InitialActiveLog | null;
}

type ExercisePreviewMedia = {
    videoUrl?: string | null;
    instructions?: string | null;
    thumbnailUrl?: string | null;
};

function getEmbedUrl(url: string) {
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes("youtube.com")) {
            const id = parsed.searchParams.get("v");
            return id ? `https://www.youtube.com/embed/${id}` : url;
        }
        if (parsed.hostname.includes("youtu.be")) {
            const id = parsed.pathname.replace("/", "");
            return id ? `https://www.youtube.com/embed/${id}` : url;
        }
        return url;
    } catch {
        return url;
    }
}

function isDirectVideo(url: string) {
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

export function WorkoutLogClient({ workout, exerciseMedia = {}, logDate, lastWorkoutLogSets = [], initialActiveLog = null }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnTo = getReturnToFromSearchParams(searchParams);
    const targetDateStr = logDate ? toDateKey(parseLogDate(logDate)) : toDateKey(new Date());
    const localStorageKey = `workout_start_time_${workout.id}_${targetDateStr}`;

    const getInitialSession = () => {
        if (initialActiveLog) {
            return restoreSessionState(initialActiveLog, workout.exercises, localStorageKey);
        }
        const now = Date.now();
        if (typeof window !== "undefined") {
            localStorage.setItem(localStorageKey, String(now));
        }
        return {
            logs: buildInitialLogs(workout.exercises),
            exercises: workout.exercises,
            startTime: now,
            activeLogId: null as string | null,
        };
    };

    const [logs, setLogs] = useState<Record<string, SetLog[]>>(
        () => getInitialSession().logs
    );
    const [startTime, setStartTime] = useState(
        () => getInitialSession().startTime
    );
    const [elapsed, setElapsed] = useState(0);
    const [saving, setSaving] = useState(false);

    const isSameDay = isSameCalendarDay;

    const [showFinishModal, setShowFinishModal] = useState(false);
    const [manualDurationMinutes, setManualDurationMinutes] = useState("");
    const [workoutNotes, setWorkoutNotes] = useState("");

    // Active exercises state (allows adding/substituting)
    const [activeExercises, setActiveExercises] = useState<Exercise[]>(
        () => getInitialSession().exercises
    );
    const [isSubstituting, setIsSubstituting] = useState<string | null>(null); // exerciseId
    const [isAddingExercise, setIsAddingExercise] = useState(false);
    const [editStartedAt, setEditStartedAt] = useState<number | null>(null); // Track when editing started
    const [searchQuery, setSearchQuery] = useState("");
    const [activeLogId, setActiveLogId] = useState<string | null>(
        () => getInitialSession().activeLogId
    );
    const [isDiscarding, setIsDiscarding] = useState(false);
    const [previewExercise, setPreviewExercise] = useState<{ name: string; media: ExercisePreviewMedia } | null>(null);
    const [modalTouchStart, setModalTouchStart] = useState<number | null>(null);

    const getWeightPlaceholder = (exerciseName: string, setNumber: number, weightTargetKg?: number | null) => {
        const lastSet = lastWorkoutLogSets.find(
            (s) => s.exerciseName.toLowerCase() === exerciseName.toLowerCase() && s.setNumber === setNumber
        );
        if (lastSet && lastSet.weightKg !== null && lastSet.weightKg !== undefined) {
            return lastSet.weightKg.toString();
        }
        if (weightTargetKg !== undefined && weightTargetKg !== null) {
            return weightTargetKg.toString();
        }
        return "";
    };

    // Fallback sync for direct links without server-prepared session
    useEffect(() => {
        if (initialActiveLog || activeLogId) return;

        let cancelled = false;

        const syncSession = async () => {
            try {
                const params = new URLSearchParams({ active: "true", workoutId: workout.id, date: targetDateStr });
                const res = await fetch(`/api/logs?${params}`);
                const active = await res.json();
                const targetDate = logDate ? parseLogDate(logDate) : new Date();

                if (cancelled) return;

                if (active && active.workoutId === workout.id && isSameDay(active.loggedAt, targetDate)) {
                    const restored = restoreSessionState(active, workout.exercises, localStorageKey);
                    setActiveLogId(restored.activeLogId);
                    setActiveExercises(restored.exercises);
                    setLogs(restored.logs);
                    setStartTime(restored.startTime);
                    return;
                }

                const now = Date.now();
                setStartTime(now);
                localStorage.setItem(localStorageKey, now.toString());

                const initialLogs = buildInitialLogs(workout.exercises);
                const flattenedSets = Object.entries(initialLogs).flatMap(([exId, sets]) => {
                    const exInfo = workout.exercises.find((e) => e.id === exId);
                    const exOrder = workout.exercises.findIndex((e) => e.id === exId);
                    return sets.map((s) => ({
                        exerciseId: exId,
                        exerciseName: exInfo?.name || "Unknown",
                        exerciseOrder: exOrder >= 0 ? exOrder : undefined,
                        setNumber: s.setNumber,
                        reps: s.reps,
                        isWarmup: s.isWarmup,
                        isCompleted: s.isCompleted,
                    }));
                });

                const createRes = await fetch("/api/logs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        workoutId: workout.id,
                        status: "IN_PROGRESS",
                        loggedAt: toLoggedAtIso(logDate ?? now),
                        sets: flattenedSets,
                    }),
                });
                if (!cancelled && createRes.ok) {
                    const saved = await createRes.json();
                    if (saved.id) setActiveLogId(saved.id);
                }
            } catch (e) {
                console.error("Failed to sync workout session:", e);
            }
        };

        syncSession();
        return () => {
            cancelled = true;
        };
    }, [activeLogId, initialActiveLog, isSameDay, localStorageKey, logDate, targetDateStr, workout.exercises, workout.id]);

    // Track when Swap/Add modal is open and adjust startTime when closed to pause timer
    useEffect(() => {
        const isEditing = isSubstituting !== null || isAddingExercise;
        if (isEditing) {
            if (!editStartedAt) {
                setEditStartedAt(Date.now());
            }
        } else {
            if (editStartedAt) {
                const editDuration = Date.now() - editStartedAt;
                setStartTime(prev => {
                    const nextStart = prev + editDuration;
                    localStorage.setItem(localStorageKey, nextStart.toString());
                    saveProgress(logs, activeExercises, nextStart);
                    return nextStart;
                });
                setEditStartedAt(null);
            }
        }
    }, [isSubstituting, isAddingExercise]);

    // Timer
    useEffect(() => {
        if (editStartedAt !== null) return;

        const updateElapsed = () => {
            setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
        };

        updateElapsed();
        const timer = setInterval(updateElapsed, 1000);

        // Instantly catch up when returning to the tab or app
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                updateElapsed();
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [startTime, editStartedAt]);

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const saveProgress = async (
        currentLogs: Record<string, SetLog[]>,
        currentExercises?: Exercise[],
        startTimeOverride?: number
    ) => {
        const exList = currentExercises || activeExercises;
        const flattenedSets = Object.entries(currentLogs).flatMap(([exId, sets]) => {
            const exInfo = exList.find(e => e.id === exId);
            const exOrder = exList.findIndex(e => e.id === exId);
            return sets.map(s => ({
                exerciseId: exId,
                exerciseName: exInfo?.name || "Unknown",
                exerciseOrder: exOrder >= 0 ? exOrder : undefined,
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
            const finalStartTime = startTimeOverride ?? startTime;
            const res = await fetch("/api/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workoutId: workout.id,
                    status: "IN_PROGRESS",
                    loggedAt: toLoggedAtIso(logDate ?? finalStartTime),
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
            const finalUpdates = { ...updates };
            
            // Auto-check logic: if weight is entered and it's not currently completed, check it
            if (updates.weightKg && updates.weightKg.trim() !== "" && !currentSet.isCompleted && updates.isCompleted === undefined) {
                finalUpdates.isCompleted = true;
            }

            // Auto-fill logic: if completing set and weight is empty, fill with placeholder
            if (updates.isCompleted === true && currentSet.weightKg === "") {
                const exInfo = activeExercises.find(e => e.id === exId);
                const placeholderWeight = getWeightPlaceholder(exInfo?.name || "", currentSet.setNumber, exInfo?.weightTargetKg);
                if (placeholderWeight) {
                    finalUpdates.weightKg = placeholderWeight;
                }
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
        
        const originalEx = activeExercises.find(ex => ex.id === isSubstituting);
        const newExId = `${isSubstituting}:sub:${generateId(4)}`;
        const nextExercises = activeExercises.map(ex => 
            ex.id === isSubstituting ? { ...ex, id: newExId, name: newName } : ex
        );
        
        setActiveExercises(nextExercises);
        setLogs(prev => {
            const next = { ...prev };
            // Carry over any existing logs or initialize default sets based on original template
            const existingSets = prev[isSubstituting] || [];
            if (existingSets.length > 0) {
                next[newExId] = existingSets;
            } else {
                const count = originalEx?.sets || 3;
                next[newExId] = Array.from({ length: count }, (_, i) => ({
                    setNumber: i + 1,
                    reps: parseInt(originalEx?.reps || "10") || 10,
                    weightKg: originalEx?.weightTargetKg?.toString() || "",
                    rpe: "",
                    isCompleted: false,
                    isWarmup: false,
                }));
            }
            delete next[isSubstituting];
            
            saveProgress(next, nextExercises);
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

        const nextExercises = [...activeExercises, newEx];
        setActiveExercises(nextExercises);
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
            saveProgress(next, nextExercises);
            return next;
        });

        setIsAddingExercise(false);
        setSearchQuery("");
    };

    const removeExercise = async (exId: string) => {
        if (!confirm("Are you sure you want to remove this exercise from this session?")) return;
        
        const nextExercises = activeExercises.filter(ex => ex.id !== exId);
        setActiveExercises(nextExercises);
        setLogs(prev => {
            const next = { ...prev };
            delete next[exId];
            saveProgress(next, nextExercises);
            return next;
        });
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
        const flattenedSets = Object.entries(logs).flatMap(([exId, sets]) => {
            const exInfo = activeExercises.find(e => e.id === exId);
            const exOrder = activeExercises.findIndex(e => e.id === exId);
            return sets.map(s => ({
                exerciseId: exId,
                exerciseName: exInfo?.name || "Unknown",
                exerciseOrder: exOrder >= 0 ? exOrder : undefined,
                setNumber: s.setNumber,
                reps: s.reps || undefined,
                weightKg: s.weightKg ? parseFloat(s.weightKg) : undefined,
                rpe: s.rpe ? parseInt(s.rpe) : undefined,
                isWarmup: s.isWarmup,
                isCompleted: s.isCompleted,
                videoUrl: s.videoUrl || undefined,
            }));
        });

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
                    loggedAt: toLoggedAtIso(logDate),
                    sets: flattenedSets,
                }),
            });
            
            if (res.ok) {
                const saved = await res.json();
                localStorage.removeItem(localStorageKey);
                setShowFinishModal(false);
                router.push(appendReturnTo(`/plans/log/view/${saved.id}`, returnTo));
                router.refresh();
            } else {
                let errMsg = "Unknown error";
                try {
                    const errData = await res.json();
                    errMsg = errData.error?.message || JSON.stringify(errData.error) || JSON.stringify(errData) || errMsg;
                } catch {
                    try {
                        errMsg = await res.text();
                    } catch {}
                }
                console.error("Save failed:", errMsg);
                alert(`Failed to save: ${errMsg}`);
            }
        } catch (err: any) {
            console.error("Submit error:", err);
            alert(`Save failed (Connection/JS Error): ${err?.message || err}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = async () => {
        localStorage.removeItem(localStorageKey);
        if (!activeLogId) {
            router.back();
            return;
        }

        if (!confirm("Discard this session? All progress for this specific session will be permanently deleted.")) return;
        
        setIsDiscarding(true);
        try {
            const res = await fetch(`/api/logs/${activeLogId}`, { method: "DELETE" });
            if (res.ok) {
                router.push(returnTo);
                router.refresh();
            }
        } catch (e) {
            console.error(e);
            alert("Failed to discard session.");
        } finally {
            setIsDiscarding(false);
        }
    };

    const scheduledDayLabel = logDate && !isSameCalendarDay(logDate, new Date())
        ? formatDate(parseLogDate(logDate), { weekday: "long", day: "numeric", month: "long" })
        : null;

    return (
        <div className="min-h-screen bg-surface flex flex-col pt-safe-area">
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-16 border-b border-surface-border glass fixed top-0 inset-x-0 z-40 md:pl-[var(--sidebar-width)]">
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

            <div className="flex-1 p-4 pt-20 pb-24 overflow-y-auto no-scrollbar md:pl-[var(--sidebar-width) + 1rem]">
                <div className="max-w-2xl mx-auto space-y-6">
                    {scheduledDayLabel && (
                        <div className="card p-3 border-brand-500/30 bg-brand-950/20 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Logging for</p>
                            <p className="text-sm font-bold text-fg mt-0.5">{scheduledDayLabel}</p>
                        </div>
                    )}
                    {activeExercises.map((ex) => {
                        const media = exerciseMedia[ex.name];
                        const hasPreview = !!(media?.videoUrl || media?.instructions);

                        return (
                        <div key={ex.id} id={`exercise-${ex.id}`} className="card p-4 space-y-4 animate-slide-up">
                            <div className="flex flex-col gap-2 w-full">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-bold text-fg text-base leading-tight">{ex.name}</h3>
                                        {hasPreview && (
                                            <button
                                                type="button"
                                                onClick={() => setPreviewExercise({ name: ex.name, media })}
                                                className="w-6 h-6 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center hover:bg-brand-500 hover:text-white transition-colors shrink-0"
                                                title="Exercise preview"
                                            >
                                                {media?.videoUrl ? <Play className="w-3 h-3 fill-current" /> : <HelpCircle className="w-3.5 h-3.5" />}
                                            </button>
                                        )}
                                    </div>
                                    {!hasPreview && (
                                        <span className="text-fg-subtle p-1 shrink-0" title="No preview available">
                                            <InfoIcon className="w-4 h-4" />
                                        </span>
                                    )}
                                </div>
                                
                                {ex.notes && <p className="text-xs text-fg-muted -mt-1">{ex.notes}</p>}

                                <div className="flex items-center gap-2 pt-1">
                                    <button 
                                        type="button"
                                        onClick={() => setIsSubstituting(ex.id)}
                                        className="text-[10px] font-black uppercase text-brand-400/60 hover:text-brand-400 bg-brand-400/5 hover:bg-brand-400/10 px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5"
                                    >
                                        <Flame className="w-3 h-3" /> Swap
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => removeExercise(ex.id)}
                                        className="text-[10px] font-black uppercase text-danger/40 hover:text-danger bg-danger/5 hover:bg-danger/10 px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5"
                                    >
                                        <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="grid grid-cols-12 gap-2 text-[11px] font-black text-fg-subtle uppercase px-1 mb-1 tracking-wider">
                                    <div className="col-span-1 text-center">{isCardio(ex.name, ex.muscleGroup) ? "Rd" : "Set"}</div>
                                    <div className="col-span-3 text-center">{isCardio(ex.name, ex.muscleGroup) ? "Lvl/Spd" : "Weight"}</div>
                                    <div className="col-span-2 text-center">{isCardio(ex.name, ex.muscleGroup) ? "Mins" : "Reps"}</div>
                                    <div className="col-span-2 text-center">RPE</div>
                                    <div className="col-span-4 text-center">Actions</div>
                                </div>

                                {logs[ex.id]?.map((set, sIdx) => (
                                    <div
                                        key={sIdx}
                                        className={cn(
                                            "grid grid-cols-12 gap-2 p-2 rounded-xl border transition-all duration-200",
                                            set.isCompleted
                                                ? "bg-success-950/20 border-success-800/40"
                                                : "bg-surface-muted/50 border-surface-border hover:border-brand-700/30"
                                        )}
                                    >
                                        <div className="col-span-1 flex items-center justify-center">
                                            <button
                                                onClick={() => updateSet(ex.id, sIdx, { isWarmup: !set.isWarmup })}
                                                className={cn(
                                                    "w-7 h-10 rounded-md text-[10px] font-bold flex items-center justify-center transition-colors shadow-sm",
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
                                                    className="input-sm w-full bg-surface-elevated border-none focus:ring-1 focus:ring-brand-500 text-center text-sm font-semibold rounded-lg h-10 px-1"
                                                    value={set.weightKg}
                                                    placeholder={getWeightPlaceholder(ex.name, set.setNumber, ex.weightTargetKg) || "0"}
                                                    onChange={(e) => updateSet(ex.id, sIdx, { weightKg: e.target.value })}
                                                />
                                                {!isCardio(ex.name, ex.muscleGroup) && (set.weightKg || getWeightPlaceholder(ex.name, set.setNumber, ex.weightTargetKg)) && (
                                                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-fg-subtle pointer-events-none">kg</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                className="input-sm w-full bg-surface-elevated border-none focus:ring-1 focus:ring-brand-500 text-center text-sm font-semibold rounded-lg h-10 px-0"
                                                value={set.reps}
                                                onChange={(e) => updateSet(ex.id, sIdx, { reps: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                className="input-sm w-full bg-surface-elevated border-none focus:ring-1 focus:ring-brand-500 text-center text-sm font-semibold rounded-lg h-10 px-0"
                                                value={set.rpe}
                                                placeholder="RPE"
                                                onChange={(e) => updateSet(ex.id, sIdx, { rpe: e.target.value })}
                                            />
                                        </div>

                                        <div className="col-span-4 flex items-center justify-end gap-1">
                                            <label className="cursor-pointer">
                                                <input 
                                                    type="file" 
                                                    accept="video/*" 
                                                    className="hidden" 
                                                    onChange={(e) => handleUploadVideo(ex.id, sIdx, e.target.files?.[0])}
                                                />
                                                <div className={cn(
                                                    "w-8 h-10 rounded-lg flex items-center justify-center transition-all",
                                                    set.isUploading ? "animate-pulse bg-brand-500/20 text-brand-400" :
                                                    set.videoUrl ? "bg-brand-500/20 text-brand-400" : "bg-surface-elevated text-fg-muted hover:bg-brand-950/20 hover:text-brand-400"
                                                )}>
                                                    <Video className="w-4 h-4" />
                                                </div>
                                            </label>
                                            <button
                                                onClick={() => updateSet(ex.id, sIdx, { isCompleted: !set.isCompleted })}
                                                className={cn(
                                                    "w-8 h-10 rounded-lg flex items-center justify-center transition-all",
                                                    set.isCompleted
                                                        ? "bg-success text-white shadow-glow-success"
                                                        : "bg-surface-elevated text-fg-muted hover:bg-brand-950/20 hover:text-brand-400"
                                                )}
                                            >
                                                <Check className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => removeSet(ex.id, sIdx)}
                                                className="w-8 h-10 rounded-lg flex items-center justify-center text-danger/40 hover:text-danger hover:bg-danger-950/20 transition-all ml-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
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
                    )})}

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

            {previewExercise && (
                <div
                    className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 animate-fade-in sm:p-4 backdrop-blur-sm"
                    onClick={() => setPreviewExercise(null)}
                >
                    <div
                        className="bg-surface-card w-full h-[92vh] sm:h-auto sm:max-h-[88vh] sm:max-w-2xl rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up flex flex-col"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => setModalTouchStart(event.clientY)}
                        onPointerUp={(event) => {
                            if (modalTouchStart !== null && event.clientY - modalTouchStart > 90) {
                                setPreviewExercise(null);
                            }
                            setModalTouchStart(null);
                        }}
                    >
                        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-border">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Exercise Preview</p>
                                <h3 className="text-lg font-black text-fg truncate">{previewExercise.name}</h3>
                            </div>
                            <button
                                onClick={() => setPreviewExercise(null)}
                                className="btn-icon"
                                title="Close preview"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {previewExercise.media.videoUrl && (
                                <div className="w-full overflow-hidden rounded-2xl border border-surface-border bg-black aspect-video">
                                    {isDirectVideo(previewExercise.media.videoUrl) ? (
                                        <video
                                            src={previewExercise.media.videoUrl}
                                            controls
                                            playsInline
                                            poster={previewExercise.media.thumbnailUrl || undefined}
                                            className="w-full h-full object-contain"
                                        />
                                    ) : (
                                        <iframe
                                            src={getEmbedUrl(previewExercise.media.videoUrl)}
                                            title={`${previewExercise.name} video preview`}
                                            className="w-full h-full"
                                            loading="lazy"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            allowFullScreen
                                        />
                                    )}
                                </div>
                            )}

                            {previewExercise.media.instructions && (
                                <div className="rounded-2xl border border-surface-border bg-surface-muted/30 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle mb-2">Instructions</p>
                                    <p className="text-sm text-fg-muted leading-relaxed whitespace-pre-wrap">{previewExercise.media.instructions}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

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

            <div className="fixed bottom-0 inset-x-0 p-4 bg-surface p-safe-area md:hidden border-t border-surface-border glass">
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
