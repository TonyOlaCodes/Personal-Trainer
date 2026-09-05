"use client";

import Link from "next/link";
import { Calendar, CheckCircle2, ChevronRight, ClipboardList, Loader2, Scale } from "lucide-react";
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
}: {
    checkIn: CoachLatestCheckIn | null;
    overdue: boolean;
    canEdit: boolean;
    canViewPhotos: boolean;
    sendingCheckInRequest: boolean;
    checkInRequestSent: boolean;
    onRequestCheckIn: () => void;
}) {
    return (
        <section className="space-y-3">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-success flex items-center gap-2 px-1">
                <Calendar className="w-3.5 h-3.5" />
                Latest Check-in
            </h3>
            {!checkIn ? (
                <div className="card p-5 border-dashed text-sm text-fg-muted">
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
                            className="btn-primary h-9 px-3 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5"
                        >
                            Review Check-in
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
