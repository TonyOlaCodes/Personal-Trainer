"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, Dumbbell, Loader2, MessageSquare, Trash2, X } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { WorkoutFeelingEditor } from "@/components/shared/WorkoutFeelingEditor";
import { workoutFeelingEmoji } from "@/lib/workoutFeeling";

interface SessionSet {
    id: string;
    setNumber: number;
    reps?: number | null;
    weightKg?: number | null;
    rpe?: number | null;
    isWarmup: boolean;
    isCompleted: boolean;
    exercise: { id: string; name: string; muscleGroup?: string | null };
}

interface CoachNote {
    id: string;
    coachId: string;
    coachName?: string | null;
    text: string;
    createdAt: string;
}

interface SessionData {
    id: string;
    workoutName: string;
    clientName?: string | null;
    loggedAt: string;
    duration?: number | null;
    notes?: string | null;
    feeling?: number | null;
    sets: SessionSet[];
    coachNotes: CoachNote[];
}

interface Props {
    sessionId: string | null;
    sessionIds?: string[];
    onClose: () => void;
    onBackToList?: () => void;
    onNavigate?: (sessionId: string) => void;
    canAddCoachNote?: boolean;
    canDelete?: boolean;
    canEditFeeling?: boolean;
    onDeleted?: () => void;
}

export function WorkoutSessionModal({
    sessionId,
    sessionIds,
    onClose,
    onBackToList,
    onNavigate,
    canAddCoachNote = false,
    canDelete = false,
    canEditFeeling = false,
    onDeleted,
}: Props) {
    const [session, setSession] = useState<SessionData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [note, setNote] = useState("");
    const [savingNote, setSavingNote] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (!sessionId) return;

        let cancelled = false;
        async function loadSession() {
            setLoading(true);
            setError("");
            try {
                const res = await fetch(`/api/logs/${sessionId}`);
                const data = await res.json();
                if (cancelled) return;
                if (res.ok) {
                    setSession(data);
                } else {
                    setError(typeof data.error === "string" ? data.error : "Could not load session");
                }
            } catch {
                if (!cancelled) setError("Could not load session");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadSession();
        return () => {
            cancelled = true;
        };
    }, [sessionId]);

    const groupedSets = useMemo(() => {
        const map = new Map<string, { exercise: SessionSet["exercise"]; sets: SessionSet[] }>();
        session?.sets.forEach((set) => {
            const key = set.exercise.id;
            if (!map.has(key)) map.set(key, { exercise: set.exercise, sets: [] });
            map.get(key)?.sets.push(set);
        });
        return Array.from(map.values());
    }, [session]);

    const currentIndex = sessionId && sessionIds ? sessionIds.indexOf(sessionId) : -1;
    const hasOlder = currentIndex >= 0 && sessionIds != null && currentIndex < sessionIds.length - 1;
    const hasNewer = currentIndex > 0;
    const showSessionNav = Boolean(sessionIds && sessionIds.length > 1 && onNavigate);

    useEffect(() => {
        if (!sessionId || !showSessionNav || !onNavigate || !sessionIds) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "ArrowLeft" && hasOlder) {
                onNavigate(sessionIds[currentIndex + 1]);
            }
            if (event.key === "ArrowRight" && hasNewer) {
                onNavigate(sessionIds[currentIndex - 1]);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [sessionId, showSessionNav, onNavigate, sessionIds, currentIndex, hasOlder, hasNewer]);

    if (!sessionId) return null;

    const deleteSession = async () => {
        if (!sessionId || deleting) return;
        if (!confirm("Delete this session permanently? All sets and notes will be lost.")) return;

        setDeleting(true);
        try {
            const res = await fetch(`/api/logs/${sessionId}`, { method: "DELETE" });
            if (res.ok) {
                onDeleted?.();
                onClose();
            } else {
                setError("Failed to delete session.");
            }
        } catch {
            setError("Failed to delete session.");
        } finally {
            setDeleting(false);
        }
    };

    const addNote = async () => {
        if (!note.trim() || savingNote) return;
        setSavingNote(true);
        try {
            const res = await fetch("/api/workout-notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workoutLogId: sessionId, text: note.trim() }),
            });
            const data = await res.json();
            if (res.ok) {
                setSession(prev => prev ? { ...prev, coachNotes: data.notes } : prev);
                setNote("");
            } else {
                setError(data.error || "Could not save note");
            }
        } finally {
            setSavingNote(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-6">
            <div className="w-full sm:max-w-3xl max-h-[92vh] bg-surface-card border border-surface-border rounded-t-3xl sm:rounded-2xl shadow-modal overflow-hidden animate-slide-up">
                <div className="p-5 border-b border-surface-border flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            {onBackToList && (
                                <button
                                    type="button"
                                    onClick={onBackToList}
                                    className="btn-ghost btn-sm text-brand-400 px-2"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    All sessions
                                </button>
                            )}
                            {showSessionNav && (
                                <div className="hidden sm:flex items-center gap-1 ml-auto sm:ml-0">
                                    <button
                                        type="button"
                                        disabled={!hasOlder}
                                        onClick={() => onNavigate?.(sessionIds![currentIndex + 1])}
                                        className="btn-icon disabled:opacity-30"
                                        title="Previous workout"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle px-1">
                                        {currentIndex + 1} / {sessionIds!.length}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={!hasNewer}
                                        onClick={() => onNavigate?.(sessionIds![currentIndex - 1])}
                                        className="btn-icon disabled:opacity-30"
                                        title="Next workout"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Workout Session</p>
                        <h3 className="heading-3 mt-1 truncate">{session?.workoutName || "Session Details"}</h3>
                        {session && (
                            <p className="text-xs text-fg-muted mt-1">
                                {session.clientName ? `${session.clientName} · ` : ""}{formatDate(session.loggedAt)}
                                {session.duration ? ` · ${session.duration} min` : ""}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="btn-icon shrink-0" title="Close">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[calc(92vh-88px)] p-5 space-y-5 pb-24 sm:pb-5">
                    {loading ? (
                        <div className="p-12 text-center">
                            <Loader2 className="w-6 h-6 mx-auto animate-spin text-brand-400" />
                            <p className="text-sm text-fg-muted mt-3">Loading session...</p>
                        </div>
                    ) : error ? (
                        <div className="p-10 text-center border border-dashed border-surface-border rounded-2xl">
                            <p className="text-sm font-bold text-fg">{error}</p>
                            <p className="text-xs text-fg-muted mt-1">{error || "Session not found"}</p>
                        </div>
                    ) : session ? (
                        <>
                            <div className="grid sm:grid-cols-3 gap-3">
                                <div className="stat-card">
                                    <Activity className="w-4 h-4 text-brand-400 mb-1" />
                                    <p className="stat-value">{groupedSets.length}</p>
                                    <p className="stat-label">Exercises</p>
                                </div>
                                <div className="stat-card">
                                    <Dumbbell className="w-4 h-4 text-success mb-1" />
                                    <p className="stat-value">{session.sets.filter(s => s.isCompleted).length}</p>
                                    <p className="stat-label">Completed Sets</p>
                                </div>
                                <div className="stat-card">
                                    <MessageSquare className="w-4 h-4 text-warning mb-1" />
                                    <p className="stat-value">{session.coachNotes.length}</p>
                                    <p className="stat-label">Coach Notes</p>
                                </div>
                            </div>

                            {(session.feeling || canEditFeeling) && (
                                <div className="card p-4 bg-surface-muted/30">
                                    {canEditFeeling ? (
                                        <WorkoutFeelingEditor
                                            logId={session.id}
                                            initialFeeling={session.feeling ?? null}
                                            canEdit
                                            align="left"
                                            onSaved={(feeling) => setSession((prev) => prev ? { ...prev, feeling } : prev)}
                                        />
                                    ) : session.feeling ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Feeling</span>
                                            <span className="text-xl leading-none">{workoutFeelingEmoji(session.feeling)}</span>
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            {session.notes && (
                                <div className="card p-4 bg-surface-muted/30">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle mb-1">Session Notes</p>
                                    <p className="text-sm text-fg-muted">{session.notes}</p>
                                </div>
                            )}

                            <div className="space-y-3">
                                {groupedSets.map((group) => (
                                    <div key={group.exercise.id} className="card p-4">
                                        <div className="flex items-center justify-between gap-4 mb-3">
                                            <div>
                                                <p className="font-bold text-fg">{group.exercise.name}</p>
                                                {group.exercise.muscleGroup && <p className="text-xs text-fg-subtle">{group.exercise.muscleGroup}</p>}
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">{group.sets.length} sets</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 text-[10px] font-black uppercase tracking-widest text-fg-subtle px-2 pb-2">
                                            <span>Set</span>
                                            <span>Reps</span>
                                            <span>Kg</span>
                                            <span>RPE</span>
                                        </div>
                                        <div className="space-y-1">
                                            {group.sets.map((set) => (
                                                <div key={set.id} className={cn("grid grid-cols-4 gap-2 rounded-lg bg-surface-muted px-2 py-2 text-sm", !set.isCompleted && "opacity-50")}>
                                                    <span>{set.setNumber}{set.isWarmup ? " W" : ""}</span>
                                                    <span>{set.reps ?? "-"}</span>
                                                    <span>{set.weightKg ?? "-"}</span>
                                                    <span>{set.rpe ?? "-"}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-400">Coach Notes</h4>
                                {session.coachNotes.length === 0 ? (
                                    <p className="text-sm text-fg-muted">No coach notes yet.</p>
                                ) : session.coachNotes.map((coachNote) => (
                                    <div key={coachNote.id} className="card p-4 bg-brand-950/10 border-brand-500/15">
                                        <div className="flex items-center justify-between gap-3 mb-1">
                                            <p className="text-xs font-black text-fg">{coachNote.coachName || "Coach"}</p>
                                            <p className="text-[10px] text-fg-subtle font-bold uppercase tracking-widest">{formatDate(coachNote.createdAt)}</p>
                                        </div>
                                        <p className="text-sm text-fg-muted whitespace-pre-wrap">{coachNote.text}</p>
                                    </div>
                                ))}
                            </div>

                            {canAddCoachNote && (
                                <div className="card p-4 border-brand-500/20 bg-brand-500/5 space-y-3">
                                    <textarea
                                        className="input min-h-24 text-sm"
                                        placeholder="Add feedback for this session..."
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                    />
                                    <button onClick={addNote} disabled={savingNote || !note.trim()} className="btn-primary w-full">
                                        {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                                        Add Feedback
                                    </button>
                                </div>
                            )}

                            {canDelete && (
                                <button
                                    type="button"
                                    onClick={deleteSession}
                                    disabled={deleting}
                                    className="btn-secondary w-full text-danger hover:bg-danger/10 hover:border-danger/30"
                                >
                                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    {deleting ? "Deleting..." : "Delete Session"}
                                </button>
                            )}
                        </>
                    ) : null}
                </div>

                {showSessionNav && session && !loading && !error && (
                    <div className="border-t border-surface-border bg-surface-card p-4 flex items-center justify-between gap-3 shrink-0">
                        <button
                            type="button"
                            disabled={!hasOlder}
                            onClick={() => onNavigate?.(sessionIds![currentIndex + 1])}
                            className="btn-secondary btn-sm flex items-center gap-1.5 disabled:opacity-40"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                        </button>
                        <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle text-center">
                            {currentIndex + 1} of {sessionIds!.length}
                        </span>
                        <button
                            type="button"
                            disabled={!hasNewer}
                            onClick={() => onNavigate?.(sessionIds![currentIndex - 1])}
                            className="btn-secondary btn-sm flex items-center gap-1.5 disabled:opacity-40"
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
