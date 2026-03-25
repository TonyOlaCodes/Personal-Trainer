"use client";

import { useState } from "react";
import { Plus, Check, Play, Video, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlobalExercise {
    id: string;
    name: string;
    videoUrl: string | null;
    muscleGroup: string | null;
    isSuggestion?: boolean;
}

export function AdminExercisesClient({ initialExercises }: { initialExercises: GlobalExercise[] }) {
    const [exercises, setExercises] = useState(initialExercises);
    const [search, setSearch] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const [saving, setSaving] = useState(false);
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    const filtered = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setSaving(true);
        try {
            const res = await fetch("/api/admin/exercises", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName.trim(), muscleGroup: "Uncategorized" })
            });
            if (res.ok) {
                const created = await res.json();
                setExercises([created, ...exercises].sort((a,b) => a.name.localeCompare(b.name)));
                setNewName("");
                setIsAdding(false);
            } else {
                alert("Failed to add exercise. Might already exist.");
            }
        } finally {
            setSaving(false);
        }
    };

    const handleVideoUpload = async (exercise: GlobalExercise, file: File | undefined) => {
        if (!file) return;
        const id = exercise.id;
        setUploadingId(id);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
            if (!uploadRes.ok) throw new Error("Upload to cloud failed");
            const { url } = await uploadRes.json();

            if (exercise.isSuggestion) {
                // If it's a suggestion, we need to CREATE it first (POST)
                const res = await fetch("/api/admin/exercises", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: exercise.name, muscleGroup: exercise.muscleGroup, videoUrl: url })
                });
                if (res.ok) {
                    const created = await res.json();
                    setExercises(prev => prev.map(e => e.id === id ? created : e));
                } else {
                    alert("Failed to create global exercise from suggestion.");
                }
            } else {
                // Regular UPDATE (PATCH)
                const patchRes = await fetch("/api/admin/exercises", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id, videoUrl: url })
                });
                if (patchRes.ok) {
                    setExercises(prev => prev.map(e => e.id === id ? { ...e, videoUrl: url } : e));
                } else {
                    alert("Failed to save video URL.");
                }
            }
        } catch(e) {
            console.error(e);
            alert("Upload failed.");
        } finally {
            setUploadingId(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 animate-fade-in pb-20">
            <div className="card p-6 border-brand-500/20 mb-6 bg-gradient-to-r from-surface-card to-brand-950/10">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h2 className="heading-2">Exercise Video Dictionary</h2>
                        <p className="subheading">Add tutorials for Global Exercises. These videos show up to clients during their workouts and plan creation.</p>
                    </div>
                    <button onClick={() => setIsAdding(!isAdding)} className="btn-primary w-full sm:w-auto">
                        <Plus className="w-5 h-5" /> New Exercise
                    </button>
                </div>

                {isAdding && (
                    <div className="mt-6 flex flex-col sm:flex-row items-stretch gap-3 animate-slide-up">
                        <input
                            type="text"
                            placeholder="e.g. Incline Dumbbell Curl"
                            className="input flex-1"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleAdd();
                            }}
                        />
                        <button onClick={handleAdd} disabled={saving || !newName} className="btn-primary">
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

            <div className="space-y-3">
                {filtered.map(ex => (
                    <div key={ex.id} className="card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 fade-in">
                        <div className="flex items-center gap-4 flex-1">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                                ex.videoUrl ? "bg-brand-950/30 text-brand-400 border-brand-500/20" : "bg-surface-elevated text-fg-subtle border-surface-border"
                            )}>
                                {ex.videoUrl ? <Play className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-fg">{ex.name}</h3>
                                    {ex.isSuggestion && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider">
                                            Not in Dict
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-fg-subtle">Muscle Group: {ex.muscleGroup}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            {ex.videoUrl && (
                                <a href={ex.videoUrl} target="_blank" className="btn-secondary btn-sm flex-1 sm:flex-none">Watch Video</a>
                            )}
                            <label className={cn("btn-sm flex-1 sm:flex-none cursor-pointer flex justify-center", ex.videoUrl ? "btn-secondary" : "btn-primary")}>
                                {uploadingId === ex.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (ex.videoUrl ? "Replace Video" : "Upload Video")}
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="video/*" 
                                    onChange={(e) => handleVideoUpload(ex, e.target.files?.[0])}
                                />
                            </label>
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
