"use client";

import Link from "next/link";
import {
    AlertTriangle, CheckCircle2, ChevronRight, ClipboardList, Clock, Dumbbell,
    Loader2, MessageSquare,
} from "lucide-react";
import { cn, formatDate, formatRelative, getInitials } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import { formatPresenceWithWorkout, getPresenceIndicator } from "@/lib/userPresence";
import type { CoachActiveWorkout, CoachAttentionItem } from "@/lib/coachClientProfileData";

export function ClientHeaderCard({
    client,
    isCoachPaused,
    canEdit,
}: {
    client: {
        id: string;
        name?: string | null;
        email: string;
        avatarUrl?: string | null;
        assignedCoachName?: string | null;
        goal?: string | null;
        experience?: string | null;
        trainingDaysPerWeek?: number | null;
        lastActiveAt?: string | null;
        activeSessionName?: string | null;
    };
    isCoachPaused: boolean;
    canEdit: boolean;
}) {
    const presence = getPresenceIndicator(client.lastActiveAt);
    const presenceWorkoutLabel = formatPresenceWithWorkout(
        client.lastActiveAt,
        client.activeSessionName ?? null
    );

    return (
        <div className="card px-5 py-4 flex flex-col sm:flex-row items-center gap-4 justify-between text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-brand flex items-center justify-center text-lg font-bold text-white shadow-glow-brand shrink-0">
                    {client.avatarUrl
                        ? <img src={resolveUploadUrl(client.avatarUrl)} alt="" className="w-full h-full object-cover rounded-2xl" />
                        : getInitials(client.name)}
                </div>
                <div className="min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-center sm:justify-start">
                        <h2 className="text-xl font-bold text-fg tracking-tight truncate">
                            {client.name || "Client"}
                        </h2>
                        <span className={cn(
                            "px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest w-fit mx-auto sm:mx-0",
                            isCoachPaused
                                ? "bg-surface-muted text-fg-muted border-surface-border"
                                : "bg-success/10 text-success border-success/25"
                        )}>
                            {isCoachPaused ? "Paused" : "Active"}
                        </span>
                    </div>
                    <p className="text-sm text-fg-muted mt-0.5 truncate">{client.email}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2 justify-center sm:justify-start">
                        {client.assignedCoachName && (
                            <span className="badge text-[9px] bg-surface-muted text-fg-muted border border-surface-border">
                                Coach: {client.assignedCoachName}
                            </span>
                        )}
                        {client.goal && (
                            <span className="badge text-[9px] bg-brand-500/10 text-brand-400 border border-brand-500/20">
                                {client.goal.replaceAll("_", " ")}
                            </span>
                        )}
                        {client.experience && (
                            <span className="badge text-[9px] bg-warning-500/10 text-warning border border-warning-500/20">
                                {client.experience.replaceAll("_", " ")}
                            </span>
                        )}
                        {client.trainingDaysPerWeek != null && (
                            <span className="badge text-[9px] bg-surface-muted text-fg-muted border border-surface-border">
                                {client.trainingDaysPerWeek} days / wk
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[10px] text-fg-subtle font-bold">
                            <span className={cn("w-1.5 h-1.5 rounded-full", presence.dotClassName)} />
                            {client.activeSessionName ? presenceWorkoutLabel : presence.label}
                        </span>
                    </div>
                </div>
            </div>
            <Link
                href={`/chat?with=${client.id}`}
                className={cn(
                    "btn-secondary px-5 h-10 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest",
                    !canEdit && "opacity-50 pointer-events-none"
                )}
                aria-disabled={!canEdit}
            >
                <MessageSquare className="w-4 h-4" />
                Message
            </Link>
        </div>
    );
}

export function CurrentWorkoutCard({ workout }: { workout: CoachActiveWorkout }) {
    return (
        <div className="card p-4 sm:p-5 border-warning/30 bg-warning/5 shadow-glow-warning-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-warning/10 border border-warning/25 flex items-center justify-center shrink-0">
                        <Dumbbell className="w-5 h-5 text-warning" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-warning">In progress now</p>
                        <h3 className="text-lg font-black text-fg tracking-tight truncate">{workout.name}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-fg-muted">
                            <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Started {formatDate(workout.startedAt, { hour: "numeric", minute: "2-digit", day: undefined, month: undefined, year: undefined })}
                            </span>
                            {workout.elapsedMinutes != null && (
                                <span>{workout.elapsedMinutes} min elapsed</span>
                            )}
                            {workout.totalSets > 0 && (
                                <span>{workout.completedSets}/{workout.totalSets} sets</span>
                            )}
                            {workout.totalExercises > 0 && (
                                <span>{workout.completedExercises}/{workout.totalExercises} exercises</span>
                            )}
                        </div>
                    </div>
                </div>
                <Link
                    href={workout.href}
                    className="btn-primary h-10 px-4 inline-flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest shadow-glow-brand lg:shrink-0"
                >
                    Review Workout
                    <ChevronRight className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
}

export function NeedsAttentionCard({
    items,
    canEdit,
    sendingCheckInRequest,
    checkInRequestSent,
    checkInRequestError,
    onRequestCheckIn,
}: {
    items: CoachAttentionItem[];
    canEdit: boolean;
    sendingCheckInRequest: boolean;
    checkInRequestSent: boolean;
    checkInRequestError: string | null;
    onRequestCheckIn: () => void;
}) {
    if (items.length === 0) {
        return (
            <div className="rounded-xl border border-success/20 bg-success/5 px-4 py-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <p className="text-xs font-bold text-success">No urgent issues</p>
            </div>
        );
    }

    return (
        <section className="space-y-2">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-warning flex items-center gap-2 px-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Needs Attention
            </h3>
            <div className="space-y-2">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className={cn(
                            "card px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between",
                            item.urgent ? "border-warning/30 bg-warning/5" : "border-surface-border"
                        )}
                    >
                        <div className="min-w-0">
                            <p className={cn(
                                "text-sm font-black tracking-tight",
                                item.urgent ? "text-warning" : "text-fg"
                            )}>
                                {item.title}
                            </p>
                            <p className="text-xs text-fg-muted mt-0.5">{item.detail}</p>
                        </div>
                        {canEdit && item.action === "request_checkin" && (
                            checkInRequestSent ? (
                                <span className="text-xs font-bold text-success inline-flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4" /> Request sent
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => void onRequestCheckIn()}
                                    disabled={sendingCheckInRequest}
                                    className="btn-primary h-9 px-3 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5"
                                >
                                    {sendingCheckInRequest
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <ClipboardList className="w-3.5 h-3.5" />}
                                    Request Check-in
                                </button>
                            )
                        )}
                        {item.action !== "request_checkin" && item.href && item.actionLabel && (
                            <Link
                                href={item.href}
                                className="btn-secondary h-9 px-3 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 shrink-0"
                            >
                                {item.actionLabel}
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                        )}
                        {checkInRequestError && item.action === "request_checkin" && (
                            <p className="text-[11px] text-danger font-semibold">{checkInRequestError}</p>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}

export function formatLastTrained(iso: string | null): string {
    if (!iso) return "—";
    return formatRelative(iso);
}
