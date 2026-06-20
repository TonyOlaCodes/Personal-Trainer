"use client";

import { useMemo, useState } from "react";
import { Plus, Check, Search, Loader2, Dumbbell, Pencil, X } from "lucide-react";
import { MUSCLE_GROUPS, muscleGroupBadgeClass } from "@/lib/muscleGroups";

interface GlobalExercise {
    id: string;
    name: string;
    videoUrl?: string | null;
    instructions?: string | null;
    thumbnailUrl?: string | null;
    muscleGroup: string | null;
    isSuggestion?: boolean;
}

type ExerciseDraft = {
    name: string;
    muscleGroup: string;
    videoUrl: string;
    instructions: string;
    thumbnailUrl: string;
};

const emptyDraft: ExerciseDraft = {
    name: "",
    muscleGroup: "Uncategorized",
    videoUrl: "",
    instructions: "",
    thumbnailUrl: "",
};

function draftFromExercise(exercise: GlobalExercise): ExerciseDraft {
    return {
        name: exercise.name,
        muscleGroup: exercise.muscleGroup || "Uncategorized",
        videoUrl: exercise.videoUrl || "",
        instructions: exercise.instructions || "",
        thumbnailUrl: exercise.thumbnailUrl || "",
    };
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

    const filtered = exercises.filter((e) => {
        const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
        const matchesGroup = groupFilter === "All" || (e.muscleGroup ?? "Uncategorized") === groupFilter;
        return matchesSearch && matchesGroup;
    });

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
        return orderedKeys.map((key) => ({ key, items: groups.get(key)!.sort((a, b) => a.name.localeCompare(b.name)) }));
    }, [filtered]);

    const groupCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const ex of exercises) {
            if (ex.isSuggestion) continue;
            const key = ex.muscleGroup || "Uncategorized";
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return counts;
    }, [exercises]);

    const handleAdd = async () => {
        if (!newExercise.name.trim()) return;
        setSaving(true);
        try {
            const res = await fetch("/api/admin/exercises", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newExercise)
            });
            if (res.ok) {
                const created = await res.json();
                setExercises([{ ...created, ...newExercise }, ...exercises].sort((a,b) => a.name.localeCompare(b.name)));
                setNewExercise(emptyDraft);
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
                body: JSON.stringify({ id: exercise.id, ...editingExercise })
            });
            if (res.ok) {
                const updated = await res.json();
                setExercises(prev => prev.map(e => e.id === exercise.id ? { ...updated, ...editingExercise } : e).sort((a,b) => a.name.localeCompare(b.name)));
                setEditingId(null);
            } else {
                const data = await res.json().catch(() => null);
                alert(data?.error?.fieldErrors?.videoUrl?.[0] || data?.error?.fieldErrors?.thumbnailUrl?.[0] || "Failed to update exercise.");
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
                setExercises(prev => prev.map(e => e.id === exercise.id ? created : e));
            } else {
                alert("Failed to add exercise. Might already exist.");
            }
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
                        <p className="subheading">Manage the global exercise list used during workouts and plan creation.</p>
                    </div>
                    <button onClick={() => setIsAdding(!isAdding)} className="btn-primary w-full sm:w-auto">
                        <Plus className="w-5 h-5" /> New Exercise
                    </button>
                </div>

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

            <div className="flex flex-wrap gap-2 mb-4">
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
                    return (
                    <div key={ex.id} className="card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 fade-in">
                        <div className="flex items-center gap-4 flex-1">
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
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${muscleGroupBadgeClass(ex.muscleGroup)}`}>
                                            {ex.muscleGroup || "Uncategorized"}
                                        </span>
                                        {ex.instructions && <p className="text-xs text-fg-muted mt-1 line-clamp-2">{ex.instructions}</p>}
                                    </>
                                )}
                            </div>
                        </div>
                        {ex.isSuggestion ? (
                            <button
                                onClick={() => addSuggestion(ex)}
                                disabled={saving}
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
                        ) : (
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
                        )}
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
