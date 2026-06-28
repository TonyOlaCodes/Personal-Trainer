"use client";

import Link from "next/link";
import { AlertCircle, ChevronRight, Dumbbell, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    buildMissedWorkoutCalendarHref,
    type MissedWorkoutYesterdayRow,
} from "@/lib/coachMissedWorkoutsYesterday";

interface Props {
    missedWorkouts: MissedWorkoutYesterdayRow[];
    dateLabel: string;
}

export function MissedWorkoutsClient({ missedWorkouts, dateLabel }: Props) {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-start gap-3">
                <Link
                    href="/coach"
                    className="mt-1 p-2 rounded-xl border border-surface-border text-fg-subtle hover:text-brand-400 hover:border-brand-500/30 transition-colors"
                    aria-label="Back to coach dashboard"
                >
                    <ArrowLeft className="w-4 h-4" />
                </Link>
                <div>
                    <h2 className="text-xl font-black text-fg">Missed Yesterday&apos;s Workouts</h2>
                    <p className="text-xs text-fg-muted mt-0.5">
                        {missedWorkouts.length === 0
                            ? `No clients missed a scheduled workout on ${dateLabel}.`
                            : `${missedWorkouts.length} client${missedWorkouts.length === 1 ? "" : "s"} missed a scheduled workout on ${dateLabel}.`}
                    </p>
                </div>
            </div>

            {missedWorkouts.length === 0 ? (
                <div className="card p-8 text-center border-success/20 bg-success/5">
                    <Dumbbell className="w-8 h-8 text-success mx-auto mb-3 opacity-80" />
                    <p className="text-sm font-bold text-fg">All clients completed yesterday&apos;s sessions</p>
                    <p className="text-xs text-fg-muted mt-1">
                        Workouts are only marked missed after the scheduled day has passed.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {missedWorkouts.map((row) => (
                        <Link
                            key={`${row.clientId}-${row.workoutId}`}
                            href={buildMissedWorkoutCalendarHref(row)}
                            className={cn(
                                "card p-4 flex items-center justify-between gap-3 transition-all hover:border-brand-500/40 group",
                                "border-danger/30 bg-danger/5"
                            )}
                        >
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center shrink-0">
                                    <Dumbbell className="w-5 h-5 text-danger" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-fg truncate group-hover:text-brand-400 transition-colors">
                                        {row.clientName}
                                    </p>
                                    <p className="text-xs text-fg-muted mt-0.5 truncate">
                                        <span className="font-semibold text-danger">{row.workoutName}</span>
                                        {" · "}
                                        {row.dateLabel}
                                    </p>
                                    <p className="text-[10px] text-fg-subtle mt-1">
                                        Open calendar to review and follow up
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <AlertCircle className="w-5 h-5 text-danger" />
                                <ChevronRight className="w-4 h-4 text-fg-subtle group-hover:text-brand-400 transition-colors" />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
