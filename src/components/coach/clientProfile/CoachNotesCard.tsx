"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { CoachClientNote } from "@/lib/coachClientNotes";

export function CoachNotesCard({
    notes,
    canEdit,
    currentUserId,
    onCreate,
    onUpdate,
    onDelete,
}: {
    notes: CoachClientNote[];
    canEdit: boolean;
    currentUserId: string;
    onCreate: (text: string) => Promise<void>;
    onUpdate: (id: string, text: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}) {
    const [draft, setDraft] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");
    const [saving, setSaving] = useState(false);

    const addNote = async () => {
        if (!draft.trim() || saving) return;
        setSaving(true);
        try {
            await onCreate(draft.trim());
            setDraft("");
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="card p-5 space-y-4">
            <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-fg">Coach Notes</h3>
                <p className="text-[11px] text-fg-muted mt-1">
                    Private coaching notes. The client cannot see these.
                </p>
            </div>
            {canEdit && (
                <div className="space-y-2">
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Add a private note…"
                        className="input min-h-[88px] text-sm"
                    />
                    <button
                        type="button"
                        onClick={() => void addNote()}
                        disabled={saving || !draft.trim()}
                        className="btn-secondary h-9 px-3 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Add note
                    </button>
                </div>
            )}
            <div className="space-y-2 max-h-[420px] overflow-y-auto no-scrollbar">
                {notes.length === 0 ? (
                    <p className="text-sm text-fg-muted italic">No private notes yet.</p>
                ) : notes.map((note) => {
                    const canMutate = canEdit && (note.coachId === currentUserId);
                    return (
                        <div key={note.id} className="rounded-xl border border-surface-border bg-surface-muted/30 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">
                                    {formatDate(note.createdAt, { hour: "numeric", minute: "2-digit" })}
                                    {note.coachName ? ` · ${note.coachName}` : ""}
                                </p>
                                {canMutate && editingId !== note.id && (
                                    <div className="flex gap-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingId(note.id);
                                                setEditText(note.text);
                                            }}
                                            className="p-1.5 rounded-lg text-fg-subtle hover:text-brand-400"
                                            aria-label="Edit note"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void onDelete(note.id)}
                                            className="p-1.5 rounded-lg text-fg-subtle hover:text-danger"
                                            aria-label="Delete note"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {editingId === note.id ? (
                                <div className="mt-2 space-y-2">
                                    <textarea
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        className="input min-h-[72px] text-sm"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (!editText.trim()) return;
                                                await onUpdate(note.id, editText.trim());
                                                setEditingId(null);
                                            }}
                                            className="btn-primary h-8 px-3 text-[10px] font-black uppercase tracking-widest"
                                        >
                                            Save
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditingId(null)}
                                            className="btn-secondary h-8 px-3 text-[10px] font-black uppercase tracking-widest"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-fg mt-1 whitespace-pre-wrap">{note.text}</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
