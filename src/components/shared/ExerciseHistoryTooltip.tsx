import { deriveOneRMFromBestSet } from "@/lib/exerciseHistory";

export type ExerciseHistoryPoint = {
    date: string;
    weight: number;
    reps: number;
    oneRM?: number | null;
};

export function ExerciseHistoryTooltipContent({
    label,
    data,
}: {
    label?: string | number;
    data: ExerciseHistoryPoint;
}) {
    const oneRM = deriveOneRMFromBestSet(data.weight, data.reps);

    return (
        <div className="bg-surface-elevated/95 backdrop-blur-md border border-brand-500/20 p-4 rounded-2xl shadow-2xl min-w-[160px]">
            <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle mb-2.5">{label}</p>
            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-6">
                    <span className="text-xs font-bold text-fg-muted">Best Set</span>
                    <span className="text-xs font-black text-brand-400">{data.weight}kg × {data.reps}</span>
                </div>
                <div className="flex items-center justify-between gap-6 pt-1.5 border-t border-surface-border/50">
                    <span className="text-xs text-fg-muted">Estimated 1RM</span>
                    <span className="text-xs font-bold text-yellow-400">{oneRM || "—"}kg</span>
                </div>
            </div>
        </div>
    );
}
