"use client";

import { Activity, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { CoachRecentSession } from "@/lib/coachClientProfileData";
import { formatSigned, missingLabel } from "./profileUi";

export function RecentSessionsCard({
    sessions,
    onOpen,
}: {
    sessions: CoachRecentSession[];
    onOpen: (sessionId: string | null) => void;
}) {
    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-warning flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" />
                    Recent Sessions
                </h3>
                {sessions.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onOpen(null)}
                        className="btn-ghost btn-sm text-brand-400 text-[10px] font-black uppercase tracking-widest"
                    >
                        View all
                        <ChevronRight className="w-3 h-3" />
                    </button>
                )}
            </div>
            {sessions.length === 0 ? (
                <p className="text-sm text-fg-muted px-1 italic">No sessions logged yet.</p>
            ) : (
                <div className="space-y-2">
                    {sessions.slice(0, 5).map((session) => (
                        <button
                            key={session.id}
                            type="button"
                            onClick={() => onOpen(session.id)}
                            className="card p-4 w-full text-left hover:border-brand-500/40 transition-all"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-fg truncate">{session.workoutName}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle mt-1">
                                        {formatDate(session.date)} · {session.status.replace("_", " ")}
                                    </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-fg-subtle shrink-0 mt-0.5" />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-fg-muted">
                                {session.setCount > 0 && <span>{session.setCount} sets</span>}
                                {session.exerciseCount > 0 && <span>{session.exerciseCount} exercises</span>}
                                {session.volumeKg != null && <span>{session.volumeKg.toLocaleString()} kg volume</span>}
                                {session.durationMin != null && <span>{session.durationMin} min</span>}
                                {session.prCount != null && session.prCount > 0 && <span>{session.prCount} PRs</span>}
                            </div>
                            {session.vsPreviousVolumePercent != null && (
                                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-400 mt-2">
                                    {formatSigned(session.vsPreviousVolumePercent, "%", 1)} volume vs previous {session.workoutName}
                                </p>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
}

export { missingLabel };
