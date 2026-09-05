"use client";

import { useMemo, useState } from "react";
import { Plus, Check, Search, Loader2, Dumbbell, Pencil, X, Merge, CheckSquare, Copy } from "lucide-react";
import { MUSCLE_GROUPS, muscleGroupBadgeClass } from "@/lib/muscleGroups";
import { searchExercises } from "@/lib/exerciseSearch";
import {
    TrackingPresetBadge,
    TrackingSetupEditor,
} from "@/components/admin/TrackingSetupEditor";
import { MuscleTargetsEditor } from "@/components/admin/MuscleTargetsEditor";
import {
    DEFAULT_STRENGTH_SCHEMA,
    normalizeTrackingSchema,
    schemaFromPreset,
    type ExerciseTrackingSchema,
    type TrackingPreset,
} from "@/lib/exerciseTracking";
import type { MuscleTargetEntry } from "@/lib/muscleTargetEntries";

interface GlobalExercise {
    id: string;
    name: string;
    videoUrl?: string | null;
    instructions?: string | null;
    thumbnailUrl?: string | null;
    muscleGroup: string | null;
    trackingPreset?: TrackingPreset | string | null;
    trackingSchema?: ExerciseTrackingSchema;
    muscleTargets?: MuscleTargetEntry[];
    isSuggestion?: boolean;
}

type ExerciseDraft = {
    name: string;
    muscleGroup: string;
    videoUrl: string;
    instructions: string;
    thumbnailUrl: string;
    trackingSchema: ExerciseTrackingSchema;
    muscleTargets: MuscleTargetEntry[];
};

function cloneSchema(schema: ExerciseTrackingSchema): ExerciseTrackingSchema {
    return normalizeTrackingSchema({
        preset: schema.preset,
        fields: schema.fields.map((f) => ({ ...f })),
    });
}

const emptyDraft: ExerciseDraft = {
    name: "",
    muscleGroup: "Uncategorized",
    videoUrl: "",
    instructions: "",
    thumbnailUrl: "",
    trackingSchema: cloneSchema(DEFAULT_STRENGTH_SCHEMA),
    muscleTargets: [],
};

function draftFromExercise(exercise: GlobalExercise): ExerciseDraft {
    const trackingSchema = exercise.trackingSchema
        ? cloneSchema(exercise.trackingSchema)
        : schemaFromPreset("strength");
    return {
        name: exercise.name,
        muscleGroup: exercise.muscleGroup || "Uncategorized",
        videoUrl: exercise.videoUrl || "",
        instructions: exercise.instructions || "",
        thumbnailUrl: exercise.thumbnailUrl || "",
        trackingSchema,
        muscleTargets: exercise.muscleTargets ?? [],
    };
}

function trackingPayload(schema: ExerciseTrackingSchema) {
    return {
        trackingPreset: schema.preset,
        trackingFields: schema.fields,
    };
}

function groupKey(exercise: GlobalExercise) {
    return exercise.muscleGroup || "Uncategorized";
}

/** Dictionary names in the same group-then-name order shown on this screen. */
function namesInDictionaryOrder(exercises: GlobalExercise[], groupFilter: string): string[] {
    const source = exercises.filter(
        (exercise) => groupFilter === "All" || groupKey(exercise) === groupFilter
    );
    const groups = new Map<string, GlobalExercise[]>();
    for (const exercise of source) {
        const key = groupKey(exercise);
        const list = groups.get(key) ?? [];
        list.push(exercise);
        groups.set(key, list);
    }
    const extraKeys = Array.from(groups.keys())
        .filter((key) => !MUSCLE_GROUPS.includes(key as (typeof MUSCLE_GROUPS)[number]))
        .sort();
    const orderedKeys = [
        ...MUSCLE_GROUPS.filter((group) => groups.has(group)),
        ...extraKeys,
    ];
    return orderedKeys.flatMap((key) =>
        (groups.get(key) ?? [])
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((exercise) => exercise.name)
    );
}

export function AdminExercisesClient({ initialExercises }: { initialExercises: GlobalExercise[] }) {
    const [exercises, setExercises] = useState(initialExercises);
    const [search, setSearch] = useState("");
    const [groupFilter, setGroupFilter] = useState<string>("All");
    const [isAdding, setIsAdding] = useState(false);
    const [newExercise, setNewExercise] = useState<ExerciseDraft>(emptyDraft);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingExercise, setEditingExercise] = useState<ExerciseDraft>(emptyDraft);
    const [saving, setSaving] = useState(false);
    const [mergeMode, setMergeMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [mergeTargetName, setMergeTargetName] = useState("");
    const [mergeMuscleGroup, setMergeMuscleGroup] = useState("Uncategorized");
    const [copied, setCopied] = useState(false);

    const dictionaryExercises = useMemo(
        () => exercises.filter((e) => !e.isSuggestion),
        [exercises]
    );

    const filtered = useMemo(() => {
        const inGroup = exercises.filter((e) => (
            groupFilter === "All" || (e.muscleGroup ?? "Uncategorized") === groupFilter
        ));
        if (!search.trim()) return inGroup;
        return searchExercises(search, inGroup, inGroup.length);
    }, [exercises, search, groupFilter]);

    const groupedExercises = useMemo(() => {
        const groups = new Map<string, GlobalExercise[]>();
        for (const ex of filtered) {
            const key = ex.muscleGroup || "Uncategorized";
            const list = groups.get(key) ?? [];
            list.push(ex);
            groups.set(key, list);
        }
        const orderedKeys = [
            ...MUSCLE_GROUPS.filter((g) => groups.has(g)),
            ...Array.from(groups.keys()).filter((k) => !MUSCLE_GROUPS.includes(k as typeof MUSCLE_GROUPS[number])).sort(),
        ];
        return orderedKeys.map((key) => ({
            key,
            items: search.trim()
                ? groups.get(key)!
                : groups.get(key)!.slice().sort((a, b) => a.name.localeCompare(b.name)),
        }));
    }, [filtered, search]);

    const groupCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const ex of exercises) {
            if (ex.isSuggestion) continue;
            const key = ex.muscleGroup || "Uncategorized";
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return counts;
    }, [exercises]);

    const selectedExercises = dictionaryExercises.filter((e) => selectedIds.includes(e.id));
    const namesForCopy = useMemo(
        () => namesInDictionaryOrder(dictionaryExercises, groupFilter),
        [dictionaryExercises, groupFilter]
    );

    const copyCategoryNames = async () => {
        if (namesForCopy.length === 0) return;
        const text = namesForCopy.map((name, index) => `${index + 1}. ${name}`).join("\n");
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            alert("Could not copy exercise names.");
        }
    };

    const toggleSelected = (id: string) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const exitMergeMode = () => {
        setMergeMode(false);
        setSelectedIds([]);
        setMergeTargetName("");
        setMergeMuscleGroup("Uncategorized");
    };

    const handleAdd = async () => {
        if (!newExercise.name.trim()) return;
        setSaving(true);
        try {
            const res = await fetch("/api/admin/exercises", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newExercise.name,
                    muscleGroup: newExercise.muscleGroup,
                    videoUrl: newExercise.videoUrl,
                    instructions: newExercise.instructions,
                    thumbnailUrl: newExercise.thumbnailUrl,
                    muscleTargets: newExercise.muscleTargets,
                    ...trackingPayload(newExercise.trackingSchema),
                })
            });
            if (res.ok) {
                const created = await res.json();
                setExercises([{
                    ...created,
                    ...newExercise,
                    trackingPreset: created.trackingPreset ?? newExercise.trackingSchema.preset,
                    trackingSchema: created.trackingSchema ?? newExercise.trackingSchema,
                    muscleTargets: created.muscleTargets ?? newExercise.muscleTargets,
                }, ...exercises].sort((a,b) => a.name.localeCompare(b.name)));
                setNewExercise({ ...emptyDraft, trackingSchema: cloneSchema(DEFAULT_STRENGTH_SCHEMA) });
                setIsAdding(false);
            } else {
                const data = await res.json().catch(() => null);
                alert(data?.error?.fieldErrors?.videoUrl?.[0] || data?.error?.fieldErrors?.thumbnailUrl?.[0] || "Failed to add exercise. Might already exist.");
            }
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async (exercise: GlobalExercise) => {
        if (!editingExercise.name.trim()) return;
        setSaving(true);
        try {
            const res = await fetch("/api/admin/exercises", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: exercise.id,
                    name: editingExercise.name,
                    muscleGroup: editingExercise.muscleGroup,
                    videoUrl: editingExercise.videoUrl,
                    instructions: editingExercise.instructions,
                    thumbnailUrl: editingExercise.thumbnailUrl,
                    muscleTargets: editingExercise.muscleTargets,
                    ...trackingPayload(editingExercise.trackingSchema),
                })
            });
            if (res.ok) {
                const updated = await res.json();
                setExercises(prev => prev.map(e => e.id === exercise.id ? {
                    ...updated,
                    ...editingExercise,
                    trackingPreset: updated.trackingPreset ?? editingExercise.trackingSchema.preset,
                    trackingSchema: updated.trackingSchema ?? editingExercise.trackingSchema,
                    muscleTargets: updated.muscleTargets ?? editingExercise.muscleTargets,
                } : e).sort((a,b) => a.name.localeCompare(b.name)));
                setEditingId(null);
            } else {
                const data = await res.json().catch(() => null);
                alert(data?.error?.fieldErrors?.videoUrl?.[0] || data?.error?.fieldErrors?.thumbnailUrl?.[0] || data?.error || "Failed to update exercise.");
            }
        } finally {
            setSaving(false);
        }
    };

    const addSuggestion = async (exercise: GlobalExercise) => {
        setSaving(true);
        try {
            const res = await fetch("/api/admin/exercises", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: exercise.name, muscleGroup: exercise.muscleGroup })
            });
            if (res.ok) {
                const created = await res.json();
                setExercises(prev => prev.map(e => e.id === exercise.id ? {
                    ...created,
                    isSuggestion: false,
                    trackingPreset: created.trackingPreset ?? created.trackingSchema?.preset ?? exercise.trackingSchema?.preset,
                    trackingSchema: created.trackingSchema ?? exercise.trackingSchema ?? schemaFromPreset("strength"),
                } : e));
            } else {
                alert("Failed to add exercise. Might already exist.");
            }
        } finally {
            setSaving(false);
        }
    };

    const handleMerge = async () => {
        if (selectedIds.length < 2) {
            alert("Select at least two exercises to combine.");
            return;
        }
        const targetName = mergeTargetName.trim() || selectedExercises[0]?.name;
        if (!targetName) return;

        const confirmed = window.confirm(
            `Combine ${selectedExercises.length} exercises into "${targetName}"?\n\nAll logged history from the selected exercises will join this name. This cannot be undone.`
        );
        if (!confirmed) return;

        setSaving(true);
        try {
            const res = await fetch("/api/admin/exercises", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "merge",
                    sourceIds: selectedIds,
                    targetName,
                    targetMuscleGroup: mergeMuscleGroup,
                    keepId: selectedIds[0],
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                alert(data?.error || "Failed to combine exercises.");
                return;
            }

            const removed = new Set(selectedIds);
            const survivor = data.exercise
                ? {
                      ...data.exercise,
                      muscleGroup: mergeMuscleGroup,
                      instructions: data.exercise.instructions ?? null,
                      thumbnailUrl: data.exercise.thumbnailUrl ?? null,
                      trackingPreset: data.exercise.trackingPreset ?? data.exercise.trackingSchema?.preset ?? null,
                      trackingSchema: data.exercise.trackingSchema
                          ?? (data.exercise.trackingPreset
                              ? schemaFromPreset(data.exercise.trackingPreset as TrackingPreset)
                              : schemaFromPreset("strength")),
                  }
                : {
                      id: selectedIds[0],
                      name: targetName,
                      muscleGroup: mergeMuscleGroup,
                      videoUrl: null,
                      instructions: null,
                      thumbnailUrl: null,
                      trackingPreset: "strength" as TrackingPreset,
                      trackingSchema: schemaFromPreset("strength"),
                  };

            setExercises((prev) =>
                [
                    ...prev.filter((e) => !removed.has(e.id) || e.id === survivor.id),
                    ...prev.some((e) => e.id === survivor.id) ? [] : [survivor],
                ]
                    .map((e) => (e.id === survivor.id || e.name.toLowerCase() === targetName.toLowerCase() ? { ...e, ...survivor } : e))
                    .filter((e, i, arr) => {
                        // Drop duplicates after fold
                        const key = e.isSuggestion ? e.id : e.name.toLowerCase();
                        return arr.findIndex((x) => (x.isSuggestion ? x.id : x.name.toLowerCase()) === key) === i;
                    })
                    .sort((a, b) => a.name.localeCompare(b.name))
            );
            exitMergeMode();
            alert(
                `Combined into "${data.targetName}".\n` +
                    `Plans remapped: ${data.planRenamed + data.planMerged}\n` +
                    `Logged sets joined: ${data.logSetsMoved + data.logNamesRewritten}`
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 animate-fade-in pb-20">
            <div className="card p-6 border-brand-500/20 mb-6 bg-gradient-to-r from-surface-card to-brand-950/10">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h2 className="heading-2">Exercise Dictionary</h2>
                        <p className="subheading">
                            Edit names, muscle groups, and media — or combine duplicates so all logged history joins one exercise.
                        </p>
                    </div>
                    <div className="flex w-full sm:w-auto gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (mergeMode) exitMergeMode();
                                else {
                                    setIsAdding(false);
                                    setEditingId(null);
                                    setMergeMode(true);
                                    setMergeTargetName("");
                                    setMergeMuscleGroup("Uncategorized");
                                }
                            }}
                            className={`btn-secondary w-full sm:w-auto ${mergeMode ? "ring-2 ring-brand-500/40" : ""}`}
                        >
                            <Merge className="w-5 h-5" />
                            {mergeMode ? "Cancel combine" : "Combine"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                exitMergeMode();
                                setIsAdding(!isAdding);
                            }}
                            className="btn-primary w-full sm:w-auto"
                        >
                            <Plus className="w-5 h-5" /> New Exercise
                        </button>
                    </div>
                </div>

                {mergeMode && (
                    <div className="mt-6 space-y-3 animate-slide-up rounded-xl border border-surface-border bg-surface-muted/40 p-4">
                        <p className="text-sm text-fg-muted">
                            Select 2+ dictionary exercises, pick the final name and muscle group, then combine.
                            Logged sets from every selected name are remapped onto the survivor.
                        </p>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <input
                                className="input"
                                placeholder={selectedExercises[0]?.name || "Final exercise name"}
                                value={mergeTargetName}
                                onChange={(e) => setMergeTargetName(e.target.value)}
                            />
                            <select
                                className="input"
                                value={mergeMuscleGroup}
                                onChange={(e) => setMergeMuscleGroup(e.target.value)}
                            >
                                {MUSCLE_GROUPS.map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                                <option value="Uncategorized">Uncategorized</option>
                            </select>
                        </div>
                        {selectedExercises.length > 0 && (
                            <p className="text-xs text-fg-muted">
                                Selected: {selectedExercises.map((e) => e.name).join(" · ")}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={handleMerge}
                            disabled={saving || selectedIds.length < 2}
                            className="btn-primary"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                            Combine {selectedIds.length || ""} exercises
                        </button>
                    </div>
                )}

                {isAdding && (
                    <div className="mt-6 grid sm:grid-cols-2 gap-3 animate-slide-up">
                        <input
                            type="text"
                            placeholder="e.g. Incline Dumbbell Curl"
                            className="input"
                            value={newExercise.name}
                            onChange={(e) => setNewExercise(prev => ({ ...prev, name: e.target.value }))}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleAdd();
                            }}
                        />
                        <select
                            className="input"
                            value={newExercise.muscleGroup}
                            onChange={(e) => setNewExercise(prev => ({ ...prev, muscleGroup: e.target.value }))}
                        >
                            {MUSCLE_GROUPS.map((g) => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                            <option value="Uncategorized">Uncategorized</option>
                        </select>
                        <input
                            type="url"
                            placeholder="Video URL"
                            className="input sm:col-span-2"
                            value={newExercise.videoUrl}
                            onChange={(e) => setNewExercise(prev => ({ ...prev, videoUrl: e.target.value }))}
                        />
                        <input
                            type="url"
                            placeholder="Thumbnail URL"
                            className="input sm:col-span-2"
                            value={newExercise.thumbnailUrl}
                            onChange={(e) => setNewExercise(prev => ({ ...prev, thumbnailUrl: e.target.value }))}
                        />
                        <textarea
                            placeholder="Instructions"
                            className="input min-h-24 sm:col-span-2 resize-none"
                            value={newExercise.instructions}
                            onChange={(e) => setNewExercise(prev => ({ ...prev, instructions: e.target.value }))}
                        />
                        <button onClick={handleAdd} disabled={saving || !newExercise.name} className="btn-primary sm:col-span-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Add to Dictionary
                        </button>
                    </div>
                )}
            </div>

            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
                <input
                    type="text"
                    placeholder="Search exercises..."
                    className="input pl-10 h-12"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                    type="button"
                    onClick={() => setGroupFilter("All")}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${groupFilter === "All" ? "bg-brand-500/20 text-brand-300 border-brand-500/30" : "bg-surface-muted text-fg-subtle border-surface-border hover:text-fg"}`}
                >
                    All ({exercises.filter(e => !e.isSuggestion).length})
                </button>
                {MUSCLE_GROUPS.map((g) => {
                    const count = groupCounts.get(g) ?? 0;
                    if (!count) return null;
                    return (
                        <button
                            key={g}
                            type="button"
                            onClick={() => setGroupFilter(g)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${groupFilter === g ? muscleGroupBadgeClass(g) : "bg-surface-muted text-fg-subtle border-surface-border hover:text-fg"}`}
                        >
                            {g} ({count})
                        </button>
                    );
                })}
                <button
                    type="button"
                    onClick={() => void copyCategoryNames()}
                    disabled={namesForCopy.length === 0}
                    className="px-3 py-1.5 rounded-full text-xs font-bold border bg-surface-muted text-fg-subtle border-surface-border hover:text-fg disabled:opacity-50 inline-flex items-center gap-1.5"
                    title={
                        groupFilter === "All"
                            ? "Copy all exercise names"
                            : `Copy ${groupFilter} exercise names`
                    }
                >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy"}
                </button>
            </div>

            <div className="space-y-6">
                {groupedExercises.map(({ key, items }) => (
                    <div key={key}>
                        <div className="flex items-center gap-2 mb-3 px-1">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${muscleGroupBadgeClass(key)}`}>
                                {key}
                            </span>
                            <span className="text-xs text-fg-muted font-semibold">{items.length} exercises</span>
                        </div>
                        <div className="space-y-3">
                {items.map(ex => {
                    const isEditing = editingId === ex.id;
                    const isSelected = selectedIds.includes(ex.id);
                    return (
                    <div
                        key={ex.id}
                        className={`card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 fade-in ${
                            mergeMode && isSelected ? "ring-2 ring-brand-500/50 border-brand-500/30" : ""
                        }`}
                    >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            {mergeMode && !ex.isSuggestion && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        toggleSelected(ex.id);
                                        if (!mergeTargetName) setMergeTargetName(ex.name);
                                        if (mergeMuscleGroup === "Uncategorized" && ex.muscleGroup) {
                                            setMergeMuscleGroup(ex.muscleGroup);
                                        }
                                    }}
                                    className={`h-6 w-6 rounded-md border flex items-center justify-center shrink-0 ${
                                        isSelected
                                            ? "bg-brand-500 border-brand-500 text-white"
                                            : "border-surface-border text-transparent"
                                    }`}
                                    aria-label={`Select ${ex.name}`}
                                >
                                    <Check className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-surface-elevated text-fg-subtle border-surface-border">
                                <Dumbbell className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                {isEditing ? (
                                    <div className="grid sm:grid-cols-2 gap-2 w-full">
                                        <input className="input input-sm" value={editingExercise.name} onChange={(e) => setEditingExercise(prev => ({ ...prev, name: e.target.value }))} />
                                        <select className="input input-sm" value={editingExercise.muscleGroup} onChange={(e) => setEditingExercise(prev => ({ ...prev, muscleGroup: e.target.value }))}>
                                            {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                                            <option value="Uncategorized">Uncategorized</option>
                                        </select>
                                        <input type="url" className="input input-sm sm:col-span-2" placeholder="Video URL" value={editingExercise.videoUrl} onChange={(e) => setEditingExercise(prev => ({ ...prev, videoUrl: e.target.value }))} />
                                        <input type="url" className="input input-sm sm:col-span-2" placeholder="Thumbnail URL" value={editingExercise.thumbnailUrl} onChange={(e) => setEditingExercise(prev => ({ ...prev, thumbnailUrl: e.target.value }))} />
                                        <textarea className="input input-sm min-h-20 sm:col-span-2 resize-none" placeholder="Instructions" value={editingExercise.instructions} onChange={(e) => setEditingExercise(prev => ({ ...prev, instructions: e.target.value }))} />
                                        <div className="sm:col-span-2">
                                            <TrackingSetupEditor
                                                value={editingExercise.trackingSchema}
                                                onChange={(trackingSchema) =>
                                                    setEditingExercise((prev) => ({ ...prev, trackingSchema }))
                                                }
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <MuscleTargetsEditor
                                                value={editingExercise.muscleTargets}
                                                onChange={(muscleTargets) =>
                                                    setEditingExercise((prev) => ({ ...prev, muscleTargets }))
                                                }
                                                exerciseName={editingExercise.name}
                                                muscleGroup={editingExercise.muscleGroup}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-fg truncate">{ex.name}</h3>
                                            {ex.isSuggestion && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                                                    Not in Dict
                                                </span>
                                            )}
                                            {ex.videoUrl && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20 uppercase tracking-wider">
                                                    Video
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${muscleGroupBadgeClass(ex.muscleGroup)}`}>
                                                {ex.muscleGroup || "Uncategorized"}
                                            </span>
                                            <TrackingPresetBadge
                                                preset={
                                                    (ex.trackingSchema?.preset ??
                                                        ex.trackingPreset) as TrackingPreset | null | undefined
                                                }
                                            />
                                        </div>
                                        {ex.instructions && <p className="text-xs text-fg-muted mt-1 line-clamp-2">{ex.instructions}</p>}
                                    </>
                                )}
                            </div>
                        </div>
                        {ex.isSuggestion ? (
                            <button
                                onClick={() => addSuggestion(ex)}
                                disabled={saving || mergeMode}
                                className="btn-primary btn-sm w-full sm:w-auto"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Add
                            </button>
                        ) : isEditing ? (
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button onClick={() => handleSave(ex)} disabled={saving} className="btn-primary btn-sm flex-1 sm:flex-none">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Save
                                </button>
                                <button onClick={() => setEditingId(null)} className="btn-secondary btn-sm flex-1 sm:flex-none">
                                    <X className="w-4 h-4" />
                                    Cancel
                                </button>
                            </div>
                        ) : !mergeMode ? (
                            <button
                                onClick={() => {
                                    setEditingId(ex.id);
                                    setEditingExercise(draftFromExercise(ex));
                                }}
                                className="btn-secondary btn-sm w-full sm:w-auto"
                            >
                                <Pencil className="w-4 h-4" />
                                Edit
                            </button>
                        ) : null}
                    </div>
                )})}
                        </div>
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="card p-12 text-center text-fg-muted font-semibold bg-transparent border-dashed">
                        No exercises found. Add one above!
                    </div>
                )}
            </div>
        </div>
    );
}
