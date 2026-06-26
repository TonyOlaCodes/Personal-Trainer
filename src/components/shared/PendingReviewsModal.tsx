"use client";

import { CheckCircle2, ChevronRight, ClipboardList, X } from "lucide-react";
import Link from "next/link";
import { ModalOverlay } from "@/components/shared/ModalOverlay";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";

export interface PendingReviewItem {
    id: string;
    clientId: string;
    clientName: string;
    avatarUrl?: string | null;
    week: number;
    date: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    reviews: PendingReviewItem[];
}

export function PendingReviewsModal({ open, onClose, reviews }: Props) {
    if (!open) return null;

    return (
        <ModalOverlay onClose={onClose}>
            <div
                className="bg-surface-card w-full sm:max-w-lg max-h-[85vh] rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-border shrink-0">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Coach Queue</p>
                        <h3 className="text-lg font-black text-fg truncate">Pending Reviews</h3>
                        <p className="text-xs text-fg-muted mt-0.5">
                            {reviews.length === 0
                                ? "You're all caught up."
                                : `${reviews.length} check-in${reviews.length === 1 ? "" : "s"} waiting for feedback`}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="btn-icon shrink-0" title="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-surface-border min-h-0">
                    {reviews.length === 0 ? (
                        <div className="p-10 text-center">
                            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-success/70" />
                            <p className="text-sm font-bold text-fg">No pending reviews</p>
                            <p className="text-xs text-fg-muted mt-1">New client check-ins will appear here.</p>
                        </div>
                    ) : (
                        reviews.map((review) => (
                            <Link
                                key={review.id}
                                href={`/checkins?highlight=${review.id}`}
                                onClick={onClose}
                                className="flex items-center gap-3 px-5 py-4 hover:bg-surface-muted/40 transition-colors group"
                            >
                                <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0">
                                    {review.avatarUrl ? (
                                        <img
                                            src={resolveUploadUrl(review.avatarUrl)}
                                            alt={review.clientName}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        getInitials(review.clientName)
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-black text-sm text-fg truncate group-hover:text-brand-400 transition-colors">
                                            {review.clientName}
                                        </p>
                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse shadow-glow-brand shrink-0" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 mt-0.5">
                                        Week {review.week} check-in
                                    </p>
                                    <p className="text-[10px] text-fg-subtle mt-1">{formatDate(review.date)}</p>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-brand-400 shrink-0">
                                    Review
                                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                                </div>
                            </Link>
                        ))
                    )}
                </div>

                {reviews.length > 0 && (
                    <div className="px-5 py-3 border-t border-surface-border shrink-0 bg-surface-muted/20">
                        <Link
                            href="/checkins?status=PENDING"
                            onClick={onClose}
                            className={cn(
                                "flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest",
                                "text-brand-400 hover:bg-brand-500/10 transition-colors"
                            )}
                        >
                            <ClipboardList className="w-3.5 h-3.5" />
                            Open check-ins page
                        </Link>
                    </div>
                )}
            </div>
        </ModalOverlay>
    );
}
