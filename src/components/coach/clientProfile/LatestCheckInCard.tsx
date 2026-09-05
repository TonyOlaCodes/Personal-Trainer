"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Calendar, CheckCircle2, ChevronRight, ClipboardList, Edit3, Loader2, Scale, X } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { CoachLatestCheckIn } from "@/lib/coachClientProfileData";

export function LatestCheckInCard({
    checkIn,
    overdue,
    canEdit,
    canViewPhotos,
    sendingCheckInRequest,
    checkInRequestSent,
    onRequestCheckIn,
    scheduleLabel,
    scheduleUnset,
    isEditingSchedule,
    onToggleEditSchedule,
    scheduleEditor,
}: {
    checkIn: CoachLatestCheckIn | null;
    overdue: boolean;
    canEdit: boolean;
    canViewPhotos: boolean;
    sendingCheckInRequest: boolean;
    checkInRequestSent: boolean;
    onRequestCheckIn: () => void;
    scheduleLabel: string;
    scheduleUnset: boolean;
    isEditingSchedule: boolean;
    onToggleEditSchedule?: () => void;
    scheduleEditor?: ReactNode;
}) {
    return (
        <section id="check-in-schedule" className="space-y-3 scroll-mt-24">
            <div className="px-1 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-success flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        Latest Check-in
                    </h3>
                    <p className={cn(
                        "text-xs font-bold mt-1",
                        scheduleUnset ? "text-warning" : "text-fg-muted"
                    )}>
                        {scheduleLabel}
                    </p>
                </div>
                {canEdit && onToggleEditSchedule && (
                    <button
                        type="button"
                        onClick={onToggleEditSchedule}
                        className="text-brand-400 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 shrink-0 pt-0.5"
                    >
                        {isEditingSchedule
                            ? <><X className="w-3 h-3" /> Cancel</>
                            : <><Edit3 className="w-3 h-3" /> {scheduleUnset ? "Set schedule" : "Edit"}</>}
                    </button>
                )}
            </div>
            {scheduleEditor}
            {!checkIn ? (
                <div className={cn(
                    "card p-5 border-dashed text-sm text-fg-muted",
                    scheduleUnset && "border-warning/30 bg-warning/5"
                )}>
                    No check-in submitted yet.
                    {overdue && canEdit && (
                        <div className="mt-3">
                            {checkInRequestSent ? (
                                <p className="text-xs font-semibold text-success inline-flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4" /> Requested
                                </p>
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
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="card p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-black text-fg">{checkIn.periodTitle}</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle mt-1">
                                Submitted {formatDate(checkIn.submittedAt)}
                            </p>
                        </div>
                        <span className={cn(
                            "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit",
                            checkIn.needsReview
                                ? "bg-brand-500 text-white"
                                : "border border-success/30 text-success"
                        )}>
                            {checkIn.reviewStatus}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Bodyweight</p>
                            <p className="text-sm font-black text-fg inline-flex items-center gap-1">
                                <Scale className="w-3.5 h-3.5 text-fg-subtle" />
                                {checkIn.bodyweightKg != null ? `${checkIn.bodyweightKg.toFixed(1)} kg` : "—"}
                            </p>
                        </div>
                        {checkIn.ratings.filter((rating) => rating.value != null).map((rating) => (
                            <div key={rating.key}>
                                <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">{rating.label}</p>
                                <p className="text-sm font-black text-fg">{rating.value}/5</p>
                            </div>
                        ))}
                    </div>
                    {checkIn.notes && (
                        <p className="text-sm text-fg-muted whitespace-pre-wrap">{checkIn.notes}</p>
                    )}
                    {checkIn.feedback && checkIn.feedback !== checkIn.notes && (
                        <p className="text-sm text-fg-muted whitespace-pre-wrap">{checkIn.feedback}</p>
                    )}
                    {canViewPhotos && (checkIn.photos.front || checkIn.photos.side) && (
                        <div className="flex gap-3">
                            {checkIn.photos.front && (
                                <img src={checkIn.photos.front} alt="Front check-in" className="h-24 w-20 object-cover rounded-xl border border-surface-border" />
                            )}
                            {checkIn.photos.side && (
                                <img src={checkIn.photos.side} alt="Side check-in" className="h-24 w-20 object-cover rounded-xl border border-surface-border" />
                            )}
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href={`/checkins?highlight=${checkIn.id}`}
                            className={cn(
                                "h-9 px-3 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5",
                                checkIn.needsReview ? "btn-primary" : "btn-secondary"
                            )}
                        >
                            {checkIn.needsReview ? "Review Check-in" : "View Check-in"}
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                            href="/checkins"
                            className="btn-secondary h-9 px-3 text-[10px] font-black uppercase tracking-widest"
                        >
                            View All Check-ins
                        </Link>
                        {overdue && canEdit && (
                            checkInRequestSent ? (
                                <span className="text-xs font-bold text-success inline-flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4" /> Requested
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => void onRequestCheckIn()}
                                    disabled={sendingCheckInRequest}
                                    className="btn-secondary h-9 px-3 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5"
                                >
                                    {sendingCheckInRequest
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <ClipboardList className="w-3.5 h-3.5" />}
                                    Request Check-in
                                </button>
                            )
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
