"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Flame, Trash2 } from "lucide-react";
import { ReturnLink } from "@/components/shared/ReturnLink";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * App-wide "you have a workout running" bar.
 *
 * Rendered from the app layout so a session can never be lost by navigating away:
 * it shows on Dashboard, Plans, Calendar, Progress and every other app page, on a
 * scheduled rest day just the same as a training day. Hidden only on the workout
 * screen itself, where the session is already on screen.
 */

export interface ResumeWorkoutSession {
    id: string;
    workoutId: string;
    workoutName: string;
    dateKey: string;
    resumeHref: string;
    completedSetCount: number;
    totalSetCount: number;
    isBackdated: boolean;
}

export function ResumeWorkoutBar({ session }: { session: ResumeWorkoutSession }) {
    const pathname = usePathname();
    const router = useRouter();
    const [discarding, setDiscarding] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    // The workout screen owns the session already; a bar there would be noise.
    if (pathname.startsWith(`/plans/log/`)) return null;
    if (dismissed) return null;

    const discard = async () => {
        if (!confirm("Discard this workout? Any sets you logged in it will be lost.")) return;
        setDiscarding(true);
        try {
            const res = await fetch(`/api/logs/${session.id}`, { method: "DELETE" });
            if (res.ok) {
                setDismissed(true);
                router.refresh();
            }
        } catch (error) {
            console.error("[ResumeWorkoutBar] discard failed", error);
        } finally {
            setDiscarding(false);
        }
    };

    const progress = session.totalSetCount > 0
        ? `${session.completedSetCount}/${session.totalSetCount} sets`
        : "Just started";

    return (
        <div className="px-4 sm:px-6 lg:px-8 pt-3">
            <div
                className={cn(
                    "card-hover p-3 sm:p-4 border border-warning-500/40 bg-gradient-to-r from-warning-600/15 to-surface-raised",
                    "shadow-glow-warning-sm"
                )}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-warning/90 flex items-center justify-center shrink-0">
                            <Flame className="w-4.5 h-4.5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-warning">
                                Workout in progress
                            </p>
                            <p className="text-sm font-bold text-fg truncate">{session.workoutName}</p>
                            <p className="text-[11px] text-fg-muted">
                                {progress}
                                {session.isBackdated && ` · logging ${formatDate(session.dateKey)}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={discard}
                            disabled={discarding}
                            aria-label="Discard workout in progress"
                            className="btn-ghost text-fg-muted hover:text-danger px-2.5"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <ReturnLink href={session.resumeHref} className="btn-primary px-4 sm:px-6">
                            Resume
                        </ReturnLink>
                    </div>
                </div>
            </div>
        </div>
    );
}
