"use client";

import { Megaphone, X } from "lucide-react";
import { ModalOverlay } from "@/components/shared/ModalOverlay";
import { cn } from "@/lib/utils";

export interface AnnouncementView {
    id: string;
    title: string;
    body: string;
    adminName: string;
}

interface Props {
    announcement: AnnouncementView;
    onDismiss: () => void;
    dismissing?: boolean;
    dismissLabel?: string;
}

export function AnnouncementModal({
    announcement,
    onDismiss,
    dismissing = false,
    dismissLabel = "Got it",
}: Props) {
    return (
        <ModalOverlay onClose={onDismiss}>
            <div
                className="bg-surface-card w-full sm:max-w-lg max-h-[85vh] rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-surface-border bg-brand-500/5 shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center shrink-0">
                                <Megaphone className="w-5 h-5 text-brand-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">
                                    Message from {announcement.adminName}
                                </p>
                                <h3 className="text-lg font-black text-fg mt-0.5 break-words">{announcement.title}</h3>
                            </div>
                        </div>
                        <button type="button" onClick={onDismiss} className="btn-icon shrink-0" aria-label="Close">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain p-5 min-h-0">
                    <p className="text-sm text-fg-muted whitespace-pre-wrap break-words leading-relaxed">
                        {announcement.body}
                    </p>
                </div>

                <div className="px-5 py-4 border-t border-surface-border shrink-0">
                    <button
                        type="button"
                        onClick={onDismiss}
                        disabled={dismissing}
                        className={cn("btn-primary w-full", dismissing && "opacity-70")}
                    >
                        {dismissing ? "Saving..." : dismissLabel}
                    </button>
                </div>
            </div>
        </ModalOverlay>
    );
}
