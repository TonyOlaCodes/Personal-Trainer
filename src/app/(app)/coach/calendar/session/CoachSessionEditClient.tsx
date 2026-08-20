"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    GripVertical,
    Loader2,
    Plus,
    Trash2,
    Save,
    RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SessionExercise = {
    id: string;
    name: string;
    sets: number;
    reps: string;
    order: number;
    weightTargetKg: number | null;
    notes?: string | null;
};

type Props = {
    clientId: string;
    clientName: string;
    dateKey: string;
    baseWorkoutId: string;
    planId: string;
    workoutName: string;
    notes: string;
    initialExercises: SessionExercise[];
    hasOverride: boolean;
};

function newExerciseId() {
    return `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CoachSessionEditClient({
    clientId,
    clientName,
    dateKey,
    baseWorkoutId,
    planId,
    workoutName: initialName,
    notes: initialNotes,
    initialExercises,
    hasOverride,
}: Props) {
    const router = useRouter();
    const [workoutName, setWorkoutName] = useState(initialName);
    const [notes, setNotes] = useState(initialNotes);
    const [exercises, setExercises] = useState<SessionExercise[]>(initialExercises);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const calendarHref = `/coach/calendar?clientId=${encodeURIComponent(clientId)}&date=${encodeURIComponent(dateKey)}`;
    const planHref = `/plans/create?id=${encodeURIComponent(planId)}&clientId=${encodeURIComponent(clientId)}`;

    const updateExercise = (id: string, patch: Partial<SessionExercise>) => {
        setExercises((prev) =>
            prev.map((ex) => (ex.id === id ? { ...ex, ...patch } : ex))
        );
    };

    const moveExercise = (index: number, direction: -1 | 1) => {
        setExercises((prev) => {
            const next = [...prev];
            const target = index + direction;
            if (target < 0 || target >= next.length) return prev;
            const tmp = next[index];
            next[index] = next[target];
            next[target] = tmp;
            return next.map((ex, order) => ({ ...ex, order }));
        });
    };

    const removeExercise = (id: string) => {
        setExercises((prev) =>
            prev.filter((ex) => ex.id !== id).map((ex, order) => ({ ...ex, order }))
        );
    };

    const addExercise = () => {
        setExercises((prev) => [
            ...prev,
            {
                id: newExerciseId(),
                name: "",
                sets: 3,
                reps: "8-12",
                order: prev.length,
                weightTargetKg: null,
                notes: null,
            },
        ]);
    };

    const save = async () => {
        const cleaned = exercises
            .map((ex, order) => ({ ...ex, name: ex.name.trim(), order }))
            .filter((ex) => ex.name.length > 0);
        if (cleaned.length === 0) {
            setError("Add at least one exercise.");
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/coach/session-override", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId,
                    dateKey,
                    baseWorkoutId,
                    workoutName: workoutName.trim() || null,
                    notes: notes.trim() || null,
                    exercises: cleaned,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error ?? "Could not save session");
            }
            router.push(calendarHref);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save session");
        } finally {
            setSaving(false);
        }
    };

    const resetToPlan = async () => {
        if (!hasOverride) return;
        if (!confirm("Remove this session override and restore the plan workout for this date?")) {
            return;
        }
        setResetting(true);
        setError(null);
        try {
            const res = await fetch("/api/coach/session-override", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId, dateKey, baseWorkoutId }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error ?? "Could not reset session");
            }
            router.push(calendarHref);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not reset session");
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <Link
                        href={calendarHref}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-fg-muted hover:text-fg mb-2"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to calendar
                    </Link>
                    <h2 className="text-xl font-black text-fg tracking-tight">Edit this session only</h2>
                    <p className="text-xs text-fg-muted mt-1 max-w-md">
                        Changes apply to <span className="font-semibold text-fg">{clientName}</span> on{" "}
                        <span className="font-semibold text-fg">{dateKey}</span> only. The recurring plan and
                        other days stay unchanged.
                    </p>
                </div>
            </div>

            <div className="card p-4 space-y-3 border-brand-500/20 bg-brand-500/5">
                <label className="block space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                        Session name
                    </span>
                    <input
                        className="input"
                        value={workoutName}
                        onChange={(e) => setWorkoutName(e.target.value)}
                    />
                </label>
                <label className="block space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                        Session notes
                    </span>
                    <textarea
                        className="input min-h-[72px]"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Optional coach notes for this date only"
                    />
                </label>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                        Exercises
                    </p>
                    <button
                        type="button"
                        onClick={addExercise}
                        className="btn-ghost btn-sm text-brand-400 inline-flex items-center gap-1"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add exercise
                    </button>
                </div>

                {exercises.length === 0 ? (
                    <div className="card p-6 text-center text-sm text-fg-muted">
                        No exercises yet — add one to build this session.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {exercises.map((ex, index) => (
                            <div
                                key={ex.id}
                                className="card p-3 sm:p-4 space-y-3 border-surface-border"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col gap-0.5 shrink-0">
                                        <button
                                            type="button"
                                            className="p-1 rounded-md text-fg-subtle hover:text-fg hover:bg-surface-muted disabled:opacity-30"
                                            disabled={index === 0}
                                            onClick={() => moveExercise(index, -1)}
                                            aria-label="Move up"
                                        >
                                            <GripVertical className="w-4 h-4 rotate-90" />
                                        </button>
                                    </div>
                                    <input
                                        className="input flex-1"
                                        placeholder="Exercise name"
                                        value={ex.name}
                                        onChange={(e) => updateExercise(ex.id, { name: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeExercise(ex.id)}
                                        className="p-2 rounded-xl text-danger hover:bg-danger/10"
                                        aria-label="Remove exercise"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <label className="space-y-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">
                                            Sets
                                        </span>
                                        <input
                                            type="number"
                                            min={1}
                                            className="input input-sm"
                                            value={ex.sets}
                                            onChange={(e) =>
                                                updateExercise(ex.id, {
                                                    sets: Math.max(1, Number(e.target.value) || 1),
                                                })
                                            }
                                        />
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">
                                            Reps
                                        </span>
                                        <input
                                            className="input input-sm"
                                            value={ex.reps}
                                            onChange={(e) => updateExercise(ex.id, { reps: e.target.value })}
                                        />
                                    </label>
                                    <label className="space-y-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">
                                            Target kg
                                        </span>
                                        <input
                                            type="number"
                                            min={0}
                                            step={0.5}
                                            className="input input-sm"
                                            value={ex.weightTargetKg ?? ""}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                updateExercise(ex.id, {
                                                    weightTargetKg: value === "" ? null : Number(value),
                                                });
                                            }}
                                            placeholder="—"
                                        />
                                    </label>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        className="btn-ghost btn-sm text-[10px]"
                                        disabled={index === 0}
                                        onClick={() => moveExercise(index, -1)}
                                    >
                                        Up
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-ghost btn-sm text-[10px]"
                                        disabled={index === exercises.length - 1}
                                        onClick={() => moveExercise(index, 1)}
                                    >
                                        Down
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {error && (
                <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
                    {error}
                </div>
            )}

            <div className="sticky bottom-4 space-y-2">
                <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving || resetting}
                    className={cn("btn-primary w-full h-12", (saving || resetting) && "opacity-70")}
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    {saving ? "Saving…" : "Save session changes"}
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {hasOverride && (
                        <button
                            type="button"
                            onClick={() => void resetToPlan()}
                            disabled={saving || resetting}
                            className="btn-secondary h-11 text-[10px] font-black uppercase tracking-widest inline-flex items-center justify-center gap-2"
                        >
                            {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            Restore plan workout
                        </button>
                    )}
                    <Link
                        href={planHref}
                        className="btn-secondary h-11 text-[10px] font-black uppercase tracking-widest inline-flex items-center justify-center"
                    >
                        Edit full plan instead
                    </Link>
                </div>
            </div>
        </div>
    );
}
