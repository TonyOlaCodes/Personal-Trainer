"use client";

import { cn } from "@/lib/utils";
import { WORKOUT_FEELING_EMOJIS, WORKOUT_FEELING_LABELS } from "@/lib/workoutFeeling";

interface Props {
    value: number | null;
    onChange: (value: number) => void;
    disabled?: boolean;
    showLabels?: boolean;
    className?: string;
}

export function WorkoutFeelingPicker({
    value,
    onChange,
    disabled = false,
    showLabels = true,
    className,
}: Props) {
    return (
        <div className={cn("space-y-3", className)}>
            <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle text-center">
                How did it feel?
            </p>
            <div className="grid grid-cols-5 gap-2">
                {WORKOUT_FEELING_EMOJIS.map((emoji, index) => {
                    const rating = index + 1;
                    const selected = value === rating;
                    return (
                        <button
                            key={rating}
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange(rating)}
                            title={WORKOUT_FEELING_LABELS[index]}
                            className={cn(
                                "flex flex-col items-center gap-1.5 rounded-2xl border py-2.5 px-1 transition-all",
                                selected
                                    ? "border-brand-500/50 bg-brand-500/15 shadow-glow-brand-sm scale-105"
                                    : "border-surface-border bg-surface-muted hover:border-brand-500/30 hover:bg-brand-500/5",
                                disabled && "opacity-60"
                            )}
                        >
                            <span className="text-2xl leading-none" aria-hidden>
                                {emoji}
                            </span>
                            {showLabels && (
                                <span
                                    className={cn(
                                        "text-[8px] font-black uppercase tracking-wide leading-tight text-center",
                                        selected ? "text-brand-300" : "text-fg-subtle"
                                    )}
                                >
                                    {WORKOUT_FEELING_LABELS[index]}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
