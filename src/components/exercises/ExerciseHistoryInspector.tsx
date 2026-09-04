"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsSplitViewWidth } from "@/hooks/useMediaQuery";
import { ModalOverlay } from "@/components/shared/ModalOverlay";
import { ExerciseHistoryPanel } from "@/components/exercises/ExerciseHistoryPanel";

export interface ExerciseHistoryInspectorState {
    /** Exercise currently shown in the inspector, or null when closed. */
    exerciseName: string | null;
    /** Opens the inspector, replacing whatever exercise was showing. */
    openHistory: (name: string) => void;
    closeHistory: () => void;
}

/**
 * Single-inspector state. Opening a second exercise switches the existing panel
 * rather than stacking another one.
 */
export function useExerciseHistoryInspector(): ExerciseHistoryInspectorState {
    const [exerciseName, setExerciseName] = useState<string | null>(null);

    const openHistory = useCallback((name: string) => {
        const trimmed = name.trim();
        setExerciseName(trimmed.length > 0 ? trimmed : null);
    }, []);

    const closeHistory = useCallback(() => setExerciseName(null), []);

    return { exerciseName, openHistory, closeHistory };
}

/** Small inline action that opens an exercise in the inspector. */
export function ExerciseHistoryButton({
    exerciseName,
    onOpen,
    active,
    disabled,
    className,
    label = "History",
}: {
    exerciseName: string;
    onOpen: (name: string) => void;
    active?: boolean;
    disabled?: boolean;
    className?: string;
    label?: string;
}) {
    const hasName = exerciseName.trim().length > 0;
    return (
        <button
            type="button"
            onClick={() => onOpen(exerciseName)}
            disabled={disabled || !hasName}
            title={hasName ? `View ${exerciseName} history` : "Name this exercise to see history"}
            className={cn(
                "shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                active
                    ? "text-white bg-brand-500 border-brand-500"
                    : "text-brand-400 bg-brand-500/10 border-brand-500/20 hover:bg-brand-500/15",
                className
            )}
        >
            <History className="w-3 h-3" />
            {label}
        </button>
    );
}

/**
 * The inspector as a standalone modal, for surfaces that are already a
 * multi-column layout and have no editor to shrink (e.g. the client profile).
 */
export function ExerciseHistoryModal({
    exerciseName,
    clientId,
    onClose,
}: {
    exerciseName: string | null;
    clientId?: string | null;
    onClose: () => void;
}) {
    if (!exerciseName) return null;

    return (
        <ModalOverlay onClose={onClose} alignToAppShell className="pb-20 md:pb-4">
            <div
                className="bg-surface-card w-full sm:max-w-lg h-[86dvh] sm:h-auto sm:max-h-[85vh] rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <ExerciseHistoryPanel
                    exerciseName={exerciseName}
                    clientId={clientId}
                    onClose={onClose}
                    className="flex-1 min-h-0"
                />
            </div>
        </ModalOverlay>
    );
}

/**
 * Desktop split view: the editor passed as `children` shrinks to make room for a
 * right-side history panel. Below `lg` the same panel opens as a full-screen
 * modal instead, so narrow screens never get a cramped two-column layout.
 */
export function ExerciseHistorySplit({
    exerciseName,
    clientId,
    onClose,
    children,
}: {
    exerciseName: string | null;
    clientId?: string | null;
    onClose: () => void;
    children: ReactNode;
}) {
    const splitAvailable = useIsSplitViewWidth();
    const open = Boolean(exerciseName);

    return (
        <>
            <div className="flex items-start gap-6">
                <div className="flex-1 min-w-0">{children}</div>

                {open && splitAvailable && (
                    <aside className="hidden xl:flex flex-col w-[25rem] shrink-0 sticky top-20 max-h-[calc(100dvh-6rem)] rounded-2xl border border-surface-border shadow-card overflow-hidden animate-fade-in">
                        <ExerciseHistoryPanel
                            exerciseName={exerciseName!}
                            clientId={clientId}
                            onClose={onClose}
                            className="flex-1 min-h-0"
                        />
                    </aside>
                )}
            </div>

            {open && !splitAvailable && (
                <ModalOverlay onClose={onClose} alignToAppShell className="pb-20 md:pb-4">
                    <div
                        className="bg-surface-card w-full sm:max-w-lg h-[86dvh] sm:h-auto sm:max-h-[85vh] rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ExerciseHistoryPanel
                            exerciseName={exerciseName!}
                            clientId={clientId}
                            onClose={onClose}
                            className="flex-1 min-h-0"
                        />
                    </div>
                </ModalOverlay>
            )}
        </>
    );
}
