"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    WORKOUT_FEELING_EMOJIS,
    WORKOUT_FEELING_LABELS,
    workoutFeelingEmoji,
    workoutFeelingLabel,
} from "@/lib/workoutFeeling";

interface Props {
    logId: string;
    initialFeeling: number | null;
    canEdit?: boolean;
    onSaved?: (feeling: number) => void;
    align?: "left" | "right";
    className?: string;
}

export function WorkoutFeelingEditor({
    logId,
    initialFeeling,
    canEdit = false,
    onSaved,
    align = "right",
    className,
}: Props) {
    const router = useRouter();
    const [feeling, setFeeling] = useState(initialFeeling);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setFeeling(initialFeeling);
    }, [initialFeeling]);

    const saveFeeling = async (value: number) => {
        if (saving) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/logs/${logId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ feeling: value }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(typeof data.error === "string" ? data.error : "Save failed");
            }
            setFeeling(value);
            setEditing(false);
            onSaved?.(value);
            router.refresh();
        } catch (error) {
            alert(error instanceof Error ? error.message : "Could not save feeling. Try again.");
        } finally {
            setSaving(false);
        }
    };

    const alignmentClass = align === "right" ? "items-end text-right" : "items-start text-left";
    const flexJustify = align === "right" ? "justify-end" : "justify-start";

    if (editing && canEdit) {
        return (
            <div className={cn("space-y-2", alignmentClass, className)}>
                <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">How did it feel?</p>
                <div className={cn("flex flex-wrap gap-1.5", flexJustify)}>
                    {WORKOUT_FEELING_EMOJIS.map((emoji, index) => {
                        const value = index + 1;
                        const selected = feeling === value;
                        return (
                            <button
                                key={value}
                                type="button"
                                disabled={saving}
                                onClick={() => saveFeeling(value)}
                                title={WORKOUT_FEELING_LABELS[index]}
                                className={cn(
                                    "w-9 h-9 rounded-xl border text-lg transition-all",
                                    selected
                                        ? "border-brand-500/40 bg-brand-500/15 shadow-glow-brand-sm scale-105"
                                        : "border-surface-border bg-surface-muted hover:border-brand-500/30 hover:bg-brand-500/5",
                                    saving && "opacity-60"
                                )}
                            >
                                {emoji}
                            </button>
                        );
                    })}
                </div>
                <button
                    type="button"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle hover:text-fg"
                >
                    Cancel
                </button>
            </div>
        );
    }

    return (
        <div className={cn("space-y-1", alignmentClass, className)}>
            <div className={cn("flex items-center gap-1.5", flexJustify)}>
                <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Feeling</p>
                {canEdit && (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="p-0.5 text-fg-subtle hover:text-brand-400 transition-colors"
                        title={feeling ? "Update feeling" : "Add feeling"}
                    >
                        <Pencil className="w-3 h-3" />
                    </button>
                )}
            </div>
            {feeling ? (
                <div className={cn("flex items-center gap-2", flexJustify)}>
                    <span className="text-xl leading-none" aria-hidden>{workoutFeelingEmoji(feeling)}</span>
                    <span className="text-sm font-black text-fg italic">{workoutFeelingLabel(feeling)}</span>
                </div>
            ) : (
                <div className={cn("flex gap-0.5", flexJustify)}>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Smile key={i} className="w-3.5 h-3.5 text-fg-subtle/20" />
                    ))}
                </div>
            )}
            {canEdit && !feeling && (
                <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className={cn(
                        "text-[10px] font-bold uppercase tracking-widest text-brand-400 hover:text-brand-300",
                        align === "right" ? "text-right" : "text-left"
                    )}
                >
                    Rate this workout
                </button>
            )}
        </div>
    );
}
