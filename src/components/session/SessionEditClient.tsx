"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Loader2,
    Plus,
    RefreshCw,
    Save,
    Trash2,
    RotateCcw,
    X,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { ExerciseAutocomplete } from "@/components/shared/ExerciseAutocomplete";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useVisualViewport } from "@/hooks/useVisualViewportHeight";
import {
    guessTrackingSchema,
    isFieldEnabled,
    type ExerciseTrackingSchema,
    type TrackingFieldKey,
} from "@/lib/exerciseTracking";
import {
    buildDefaultSetTargets,
    type SessionOverrideExercise,
    type SessionSetTarget,
} from "@/lib/workoutSessionOverrides";
import {
    ExerciseHistoryButton,
    ExerciseHistorySplit,
    useExerciseHistoryInspector,
} from "@/components/exercises/ExerciseHistoryInspector";
import { LastSessionPreview } from "@/components/exercises/LastSessionPreview";

type SessionExercise = SessionOverrideExercise;

type Props = {
    /** When set, coach is editing a client's session. */
    clientId?: string;
    clientName?: string;
    dateKey: string;
    baseWorkoutId: string;
    planId?: string;
    workoutName: string;
    notes: string;
    initialExercises: SessionExercise[];
    hasOverride: boolean;
    backHref: string;
};

function newExerciseId() {
    return `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureSetTargets(ex: SessionExercise): SessionSetTarget[] {
    if (ex.setTargets && ex.setTargets.length === ex.sets) return ex.setTargets;
    return buildDefaultSetTargets({
        sets: Math.max(1, ex.sets || 1),
        reps: ex.reps || "8-12",
        weightTargetKg: ex.weightTargetKg ?? null,
    });
}

function setsAreUniform(targets: SessionSetTarget[]): boolean {
    if (targets.length <= 1) return true;
    const first = targets[0];
    return targets.every(
        (t) =>
            t.weightKg === first.weightKg
            && t.reps === first.reps
            && t.durationSec === first.durationSec
            && t.distanceMeters === first.distanceMeters
            && t.heightCm === first.heightCm
            && t.rpe === first.rpe
            && t.resistance === first.resistance
            && t.inclinePct === first.inclinePct
    );
}

function summarizeExercise(ex: SessionExercise): SessionExercise {
    const setTargets = ensureSetTargets(ex);
    const first = setTargets[0];
    const uniform = setsAreUniform(setTargets);
    return {
        ...ex,
        sets: setTargets.length,
        setTargets,
        reps: uniform && first?.reps != null ? String(Math.round(first.reps)) : ex.reps,
        weightTargetKg: uniform ? (first?.weightKg ?? null) : (first?.weightKg ?? null),
    };
}

const TARGET_FIELDS: TrackingFieldKey[] = [
    "weight",
    "reps",
    "duration",
    "distance",
    "height",
    "rpe",
    "resistance",
    "incline",
];

function schemaFields(schema: ExerciseTrackingSchema): TrackingFieldKey[] {
    return TARGET_FIELDS.filter((key) => isFieldEnabled(schema, key));
}

function fieldValue(target: SessionSetTarget, key: TrackingFieldKey): string {
    switch (key) {
        case "weight":
            return target.weightKg != null ? String(target.weightKg) : "";
        case "reps":
            return target.reps != null ? String(target.reps) : "";
        case "duration":
            return target.durationSec != null ? String(target.durationSec) : "";
        case "distance":
            return target.distanceMeters != null ? String(target.distanceMeters) : "";
        case "height":
            return target.heightCm != null ? String(target.heightCm) : "";
        case "rpe":
            return target.rpe != null ? String(target.rpe) : "";
        case "resistance":
            return target.resistance != null ? String(target.resistance) : "";
        case "incline":
            return target.inclinePct != null ? String(target.inclinePct) : "";
        default:
            return "";
    }
}

function patchTargetField(
    target: SessionSetTarget,
    key: TrackingFieldKey,
    raw: string
): SessionSetTarget {
    const num = raw.trim() === "" ? null : Number(raw);
    const value = num != null && Number.isFinite(num) ? num : null;
    switch (key) {
        case "weight":
            return { ...target, weightKg: value };
        case "reps":
            return { ...target, reps: value != null ? Math.round(value) : null };
        case "duration":
            return { ...target, durationSec: value };
        case "distance":
            return { ...target, distanceMeters: value };
        case "height":
            return { ...target, heightCm: value };
        case "rpe":
            return { ...target, rpe: value };
        case "resistance":
            return { ...target, resistance: value };
        case "incline":
            return { ...target, inclinePct: value };
        default:
            return target;
    }
}

function fieldLabel(key: TrackingFieldKey): string {
    switch (key) {
        case "weight":
            return "Weight";
        case "reps":
            return "Reps";
        case "duration":
            return "Sec";
        case "distance":
            return "m";
        case "height":
            return "cm";
        case "rpe":
            return "RPE";
        case "resistance":
            return "Level";
        case "incline":
            return "Incline";
        default:
            return key;
    }
}

export function SessionEditClient({
    clientId,
    clientName,
    dateKey,
    baseWorkoutId,
    planId,
    workoutName: initialName,
    notes: initialNotes,
    initialExercises,
    hasOverride,
    backHref,
}: Props) {
    const router = useRouter();
    const [workoutName, setWorkoutName] = useState(initialName);
    const [notes, setNotes] = useState(initialNotes);
    const [exercises, setExercises] = useState<SessionExercise[]>(() =>
        initialExercises.map(summarizeExercise)
    );
    const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
        const initial = new Set<string>();
        for (const ex of initialExercises) {
            const targets = ensureSetTargets(ex);
            if (!setsAreUniform(targets)) initial.add(ex.id);
        }
        return initial;
    });
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pickerMode, setPickerMode] = useState<"add" | "swap" | null>(null);
    const [swappingId, setSwappingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Exercise History Inspector — one panel at a time, switches exercise on reopen.
    const { exerciseName: historyExercise, openHistory, closeHistory } = useExerciseHistoryInspector();

    const viewport = useVisualViewport();
    useScrollLock(Boolean(pickerMode));

    const swapSheetMaxHeight = viewport
        ? Math.min(viewport.height - 16, 420)
        : undefined;
    const swapResultsMaxHeight = viewport
        ? Math.min(224, Math.max(140, viewport.height - 200))
        : 224;

    const planHref =
        planId && clientId
            ? `/plans/create?id=${encodeURIComponent(planId)}&clientId=${encodeURIComponent(clientId)}`
            : planId
              ? `/plans/create?id=${encodeURIComponent(planId)}`
              : null;

    const updateExercise = (id: string, patch: Partial<SessionExercise>) => {
        setExercises((prev) =>
            prev.map((ex) => (ex.id === id ? summarizeExercise({ ...ex, ...patch }) : ex))
        );
    };

    const updateSetTarget = (exId: string, setNumber: number, key: TrackingFieldKey, raw: string) => {
        setExercises((prev) =>
            prev.map((ex) => {
                if (ex.id !== exId) return ex;
                const setTargets = ensureSetTargets(ex).map((t) =>
                    t.setNumber === setNumber ? patchTargetField(t, key, raw) : t
                );
                return summarizeExercise({ ...ex, setTargets, sets: setTargets.length });
            })
        );
    };

    const applyCompactToAllSets = (exId: string, key: TrackingFieldKey, raw: string) => {
        setExercises((prev) =>
            prev.map((ex) => {
                if (ex.id !== exId) return ex;
                const setTargets = ensureSetTargets(ex).map((t) => patchTargetField(t, key, raw));
                return summarizeExercise({ ...ex, setTargets, sets: setTargets.length });
            })
        );
    };

    const changeSetCount = (exId: string, nextCount: number) => {
        const count = Math.max(1, Math.min(50, Math.round(nextCount) || 1));
        setExercises((prev) =>
            prev.map((ex) => {
                if (ex.id !== exId) return ex;
                const current = ensureSetTargets(ex);
                let setTargets = current.slice(0, count);
                while (setTargets.length < count) {
                    const template = setTargets[setTargets.length - 1] ?? current[0];
                    setTargets = [
                        ...setTargets,
                        {
                            ...template,
                            setNumber: setTargets.length + 1,
                        },
                    ];
                }
                setTargets = setTargets.map((t, i) => ({ ...t, setNumber: i + 1 }));
                return summarizeExercise({ ...ex, sets: count, setTargets });
            })
        );
    };

    const removeExercise = (id: string) => {
        setExercises((prev) =>
            prev.filter((ex) => ex.id !== id).map((ex, order) => ({ ...ex, order }))
        );
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const openAddPicker = () => {
        setPickerMode("add");
        setSwappingId(null);
        setSearchQuery("");
    };

    const openSwapPicker = (id: string) => {
        setPickerMode("swap");
        setSwappingId(id);
        setSearchQuery("");
    };

    const closePicker = () => {
        setPickerMode(null);
        setSwappingId(null);
        setSearchQuery("");
    };

    const onPickExercise = (name: string) => {
        if (!name.trim()) return;
        if (pickerMode === "swap" && swappingId) {
            updateExercise(swappingId, { name: name.trim() });
        } else if (pickerMode === "add") {
            const setTargets = buildDefaultSetTargets({
                sets: 3,
                reps: "10",
                weightTargetKg: null,
            });
            setExercises((prev) => [
                ...prev,
                summarizeExercise({
                    id: newExerciseId(),
                    name: name.trim(),
                    sets: 3,
                    reps: "10",
                    order: prev.length,
                    weightTargetKg: null,
                    notes: null,
                    setTargets,
                }),
            ]);
        }
        closePicker();
    };

    const save = async () => {
        const cleaned = exercises
            .map((ex, order) => summarizeExercise({ ...ex, name: ex.name.trim(), order }))
            .filter((ex) => ex.name.length > 0);
        if (cleaned.length === 0) {
            setError("Add at least one exercise.");
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/session-override", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...(clientId ? { clientId } : {}),
                    dateKey,
                    baseWorkoutId,
                    workoutName: workoutName.trim() || null,
                    notes: notes.trim() || null,
                    exercises: cleaned,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg =
                    typeof data.error === "string"
                        ? data.error
                        : data.error?.formErrors?.[0] || "Could not save session";
                throw new Error(msg);
            }
            router.push(backHref);
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
            const res = await fetch("/api/session-override", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...(clientId ? { clientId } : {}),
                    dateKey,
                    baseWorkoutId,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(typeof data.error === "string" ? data.error : "Could not reset session");
            }
            router.push(backHref);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not reset session");
        } finally {
            setResetting(false);
        }
    };

    const dateLabel = useMemo(() => {
        try {
            return formatDate(dateKey);
        } catch {
            return dateKey;
        }
    }, [dateKey]);

    const historyOpen = Boolean(historyExercise);

    return (
        <div
            className={cn(
                // Widen the shell when the inspector is open so the editor shrinks gently.
                "mx-auto transition-[max-width] duration-300",
                historyOpen ? "max-w-2xl xl:max-w-6xl" : "max-w-2xl"
            )}
        >
        <ExerciseHistorySplit
            exerciseName={historyExercise}
            clientId={clientId}
            onClose={closeHistory}
        >
        <div className="space-y-4 animate-fade-in pb-28">
            {/* Sticky top bar with SAVE */}
            <div className={cn(
                "sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-surface/95 backdrop-blur-md border-b border-surface-border",
                // The edge bleed assumes a full-width column; drop it once the editor is split.
                historyOpen && "xl:mx-0 xl:px-0"
            )}>
                <div className="flex items-center gap-3">
                    <Link
                        href={backHref}
                        className="shrink-0 w-10 h-10 rounded-xl bg-surface-muted border border-surface-border flex items-center justify-center text-fg-muted hover:text-fg"
                        aria-label="Back"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div className="min-w-0 flex-1">
                        <input
                            className="w-full bg-transparent text-base sm:text-lg font-black text-fg tracking-tight outline-none truncate"
                            value={workoutName}
                            onChange={(e) => setWorkoutName(e.target.value)}
                            aria-label="Session name"
                        />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle truncate">
                            {clientName ? `${clientName} · ` : ""}
                            {dateLabel}
                            <span className="text-brand-400"> · Edit Session</span>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void save()}
                        disabled={saving}
                        className="btn-primary h-10 px-4 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 px-4 py-3">
                <p className="text-xs text-fg-muted leading-relaxed">
                    Editing <span className="font-semibold text-fg">{dateLabel}</span> only. This does not
                    start the workout or change other days on the plan.
                </p>
            </div>

            <label className="block space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle px-1">
                    Session notes
                </span>
                <textarea
                    className="input min-h-[72px]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes for this date only"
                />
            </label>

            {error && (
                <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-bold text-danger">
                    {error}
                </div>
            )}

            <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle px-1">
                    Exercises
                </p>

                {exercises.length === 0 ? (
                    <div className="card p-6 text-center text-sm text-fg-muted">
                        No exercises yet — add one to build this session.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {exercises.map((ex) => {
                            const schema = guessTrackingSchema(ex.name);
                            const fields = schemaFields(schema);
                            const setTargets = ensureSetTargets(ex);
                            const expanded = expandedIds.has(ex.id) || !setsAreUniform(setTargets);
                            const first = setTargets[0];

                            return (
                                <div
                                    key={ex.id}
                                    className="rounded-2xl border border-surface-border bg-surface-card p-3.5 sm:p-4 space-y-3"
                                >
                                    <div className="flex items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-fg tracking-tight truncate">
                                                {ex.name || "Untitled exercise"}
                                            </p>
                                            <p className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest mt-0.5">
                                                {ex.sets} sets · planned targets
                                            </p>
                                        </div>
                                        <ExerciseHistoryButton
                                            exerciseName={ex.name}
                                            onOpen={openHistory}
                                            active={historyExercise === ex.name.trim()}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => openSwapPicker(ex.id)}
                                            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-brand-400 bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/15"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            Swap
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeExercise(ex.id)}
                                            className="shrink-0 p-2 rounded-lg text-danger hover:bg-danger/10"
                                            aria-label="Delete exercise"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {ex.name.trim() && (
                                        <LastSessionPreview
                                            exerciseName={ex.name}
                                            clientId={clientId}
                                        />
                                    )}

                                    {!expanded ? (
                                        <div className="space-y-2">
                                            <div className="flex items-end gap-2">
                                                <label className="space-y-1 w-16 shrink-0">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">
                                                        Sets
                                                    </span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={50}
                                                        className="input input-sm"
                                                        value={ex.sets}
                                                        onChange={(e) =>
                                                            changeSetCount(ex.id, Number(e.target.value))
                                                        }
                                                    />
                                                </label>
                                                <div
                                                    className={cn(
                                                        "grid flex-1 gap-2",
                                                        fields.length <= 2
                                                            ? "grid-cols-2"
                                                            : fields.length === 3
                                                              ? "grid-cols-3"
                                                              : "grid-cols-2 sm:grid-cols-4"
                                                    )}
                                                >
                                                    {fields.map((key) => (
                                                        <label key={key} className="space-y-1 min-w-0">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">
                                                                {fieldLabel(key)}
                                                            </span>
                                                            <input
                                                                type="number"
                                                                className="input input-sm"
                                                                value={first ? fieldValue(first, key) : ""}
                                                                onChange={(e) =>
                                                                    applyCompactToAllSets(
                                                                        ex.id,
                                                                        key,
                                                                        e.target.value
                                                                    )
                                                                }
                                                                placeholder="—"
                                                            />
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExpandedIds((prev) => new Set(prev).add(ex.id))
                                                }
                                                className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-fg-muted hover:text-fg"
                                            >
                                                <ChevronDown className="w-3.5 h-3.5" />
                                                Expand sets
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setExpandedIds((prev) => {
                                                            const next = new Set(prev);
                                                            next.delete(ex.id);
                                                            return next;
                                                        })
                                                    }
                                                    className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-fg-muted hover:text-fg"
                                                >
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                    Collapse
                                                </button>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        className="btn-ghost btn-sm text-[10px]"
                                                        onClick={() => changeSetCount(ex.id, ex.sets - 1)}
                                                        disabled={ex.sets <= 1}
                                                    >
                                                        − Set
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-ghost btn-sm text-[10px]"
                                                        onClick={() => changeSetCount(ex.id, ex.sets + 1)}
                                                    >
                                                        + Set
                                                    </button>
                                                </div>
                                            </div>
                                            {setTargets.map((target) => (
                                                <div
                                                    key={target.setNumber}
                                                    className="rounded-xl border border-surface-border/70 bg-surface-muted/20 px-3 py-2.5 space-y-2"
                                                >
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">
                                                        Set {target.setNumber}
                                                    </p>
                                                    <div
                                                        className={cn(
                                                            "grid gap-2",
                                                            fields.length <= 2
                                                                ? "grid-cols-2"
                                                                : fields.length === 3
                                                                  ? "grid-cols-3"
                                                                  : "grid-cols-2 sm:grid-cols-4"
                                                        )}
                                                    >
                                                        {fields.map((key) => (
                                                            <label key={key} className="space-y-1 min-w-0">
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">
                                                                    {fieldLabel(key)}
                                                                </span>
                                                                <input
                                                                    type="number"
                                                                    className="input input-sm"
                                                                    value={fieldValue(target, key)}
                                                                    onChange={(e) =>
                                                                        updateSetTarget(
                                                                            ex.id,
                                                                            target.setNumber,
                                                                            key,
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    placeholder="—"
                                                                />
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <button
                    type="button"
                    onClick={openAddPicker}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-surface-muted/50 border border-dashed border-surface-border rounded-xl text-xs font-semibold text-fg-muted hover:text-brand-400 hover:border-brand-600 transition-all"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Exercise
                </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                {hasOverride && (
                    <button
                        type="button"
                        onClick={() => void resetToPlan()}
                        disabled={resetting}
                        className="btn-secondary h-11 text-[10px] font-black uppercase tracking-widest inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {resetting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        Reset to plan
                    </button>
                )}
                {planHref && (
                    <Link
                        href={planHref}
                        className="btn-ghost h-11 text-[10px] font-black uppercase tracking-widest inline-flex items-center justify-center text-fg-muted"
                    >
                        Edit full plan instead
                    </Link>
                )}
            </div>

            {pickerMode && (
                <div className="fixed inset-0 z-[70] flex overflow-hidden overscroll-none items-end sm:items-center justify-center bg-black/80 animate-fade-in sm:p-4">
                    <div
                        className="bg-surface-card w-full sm:max-w-md rounded-t-[1.5rem] sm:rounded-[1.5rem] border border-surface-border shadow-glow-brand-lg flex flex-col animate-slide-up overflow-hidden"
                        style={{ maxHeight: swapSheetMaxHeight ?? "min(92dvh, 100%)" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
                            <p className="text-sm font-black text-fg uppercase tracking-widest">
                                {pickerMode === "swap" ? "Swap Exercise" : "Add Exercise"}
                            </p>
                            <button
                                type="button"
                                onClick={closePicker}
                                className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4 text-fg-muted" />
                            </button>
                        </div>
                        <div className="p-4">
                            <ExerciseAutocomplete
                                value={searchQuery}
                                onChange={setSearchQuery}
                                onSelect={(name) => onPickExercise(name)}
                                autoFocus
                                resultsPlacement="inline"
                                resultsMaxHeightPx={swapResultsMaxHeight}
                                className="input h-12 font-bold border-brand-500/20 focus:border-brand-500"
                                placeholder="Search e.g. Bench Press..."
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
        </ExerciseHistorySplit>
        </div>
    );
}
