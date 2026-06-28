"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { ModalOverlay } from "@/components/shared/ModalOverlay";
import { cn } from "@/lib/utils";

const DELETE_CONFIRM_WORD = "DELETE";

interface Props {
    open: boolean;
    planName: string;
    /** Permanent delete (owned plan) vs unlink from library */
    mode: "delete" | "remove";
    activeUserCount?: number;
    busy?: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
}

export function DeletePlanConfirmModal({
    open,
    planName,
    mode,
    activeUserCount = 0,
    busy = false,
    onClose,
    onConfirm,
}: Props) {
    const [confirmText, setConfirmText] = useState("");

    useEffect(() => {
        if (!open) setConfirmText("");
    }, [open]);

    const isDelete = mode === "delete";
    const canConfirm = isDelete
        ? confirmText === DELETE_CONFIRM_WORD
        : true;

    if (!open) return null;

    return (
        <ModalOverlay open={open} onClose={busy ? undefined : onClose}>
            <div
                className="bg-surface-card w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-border">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-5 h-5 text-danger" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-black text-fg truncate">
                                {isDelete ? "Delete plan?" : "Remove from my plans?"}
                            </p>
                            <p className="text-xs text-fg-muted truncate">{planName}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="btn-icon shrink-0"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {isDelete ? (
                        <>
                            <p className="text-sm text-fg-muted leading-relaxed">
                                This permanently deletes the plan and cannot be undone. Plans with logged workout history cannot be deleted.
                            </p>
                            {activeUserCount > 0 && (
                                <p className="text-xs text-warning font-semibold">
                                    {activeUserCount} user{activeUserCount === 1 ? " has" : "s have"} this as their active plan.
                                </p>
                            )}
                            <label className="block space-y-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">
                                    Type &quot;{DELETE_CONFIRM_WORD}&quot; to confirm delete plan
                                </span>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                                    placeholder={DELETE_CONFIRM_WORD}
                                    disabled={busy}
                                    autoComplete="off"
                                    autoFocus
                                    className="input h-11 font-mono font-bold tracking-widest uppercase"
                                />
                            </label>
                        </>
                    ) : (
                        <p className="text-sm text-fg-muted leading-relaxed">
                            This removes the plan from your library only. Your logged sessions are kept safe.
                        </p>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={busy}
                            className="btn-secondary flex-1 h-11"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => void onConfirm()}
                            disabled={busy || !canConfirm}
                            className={cn(
                                "btn-primary flex-1 h-11 inline-flex items-center justify-center gap-2",
                                isDelete && "bg-danger hover:bg-danger/90 border-danger/30"
                            )}
                        >
                            {busy ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                            {busy
                                ? (isDelete ? "Deleting..." : "Removing...")
                                : (isDelete ? "Delete plan" : "Remove plan")}
                        </button>
                    </div>
                </div>
            </div>
        </ModalOverlay>
    );
}
