"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageSquare, Shield, X } from "lucide-react";
import { ModalOverlay } from "@/components/shared/ModalOverlay";
import { cn } from "@/lib/utils";

interface AccessRequestStatus {
    eligible: boolean;
    liaison: { id: string; name: string; avatarUrl?: string | null } | null;
    requestSentAt: string | null;
    defaultMessage: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
}

export function GainAccessModal({ open, onClose }: Props) {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<AccessRequestStatus | null>(null);
    const [message, setMessage] = useState("");
    const [sent, setSent] = useState(false);

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        setLoading(true);
        setError(null);
        setSent(false);

        void (async () => {
            try {
                const res = await fetch("/api/access-request");
                const data = await res.json();
                if (!res.ok) throw new Error(data.error ?? "Could not load access request");
                if (cancelled) return;
                setStatus(data);
                setMessage(data.defaultMessage ?? "");
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Could not load access request");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [open]);

    const handleSend = async () => {
        if (!message.trim() || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/access-request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: message.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Could not send request");

            if (data.alreadyAssigned && data.chatRoute) {
                window.location.href = data.chatRoute;
                return;
            }

            setSent(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not send request");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ModalOverlay open={open} onClose={onClose} className="pb-20 md:pb-4">
            <div
                className="bg-surface-card w-full sm:max-w-md max-h-[min(85dvh,calc(100dvh-5.5rem))] sm:max-h-[85vh] rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-border shrink-0">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Full access</p>
                        <h3 className="text-lg font-black text-fg truncate">Request full access</h3>
                    </div>
                    <button type="button" onClick={onClose} className="btn-icon shrink-0" aria-label="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4 min-h-0">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-7 h-7 animate-spin text-brand-400" />
                        </div>
                    ) : !status?.eligible ? (
                        <p className="text-sm text-fg-muted">Full access requests are only available for free accounts.</p>
                    ) : status.liaison ? (
                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-success/5 border border-success/20">
                                <p className="text-sm font-bold text-fg">You&apos;re in contact with {status.liaison.name}</p>
                                <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                                    This admin is handling your access request. Continue the conversation in chat.
                                </p>
                            </div>
                            <Link
                                href={`/chat?with=${status.liaison.id}`}
                                className="btn-primary w-full h-11 inline-flex items-center justify-center gap-2"
                                onClick={onClose}
                            >
                                <MessageSquare className="w-4 h-4" />
                                Open chat
                            </Link>
                        </div>
                    ) : sent ? (
                        <div className="space-y-4 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto">
                                <Shield className="w-6 h-6 text-brand-400" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-bold text-fg">Request sent</p>
                                <p className="text-xs text-fg-muted leading-relaxed">
                                    Your message was sent to our admin team. Whoever replies first will be your point of contact.
                                </p>
                            </div>
                            <Link href="/chat" className="btn-primary w-full h-11 inline-flex items-center justify-center gap-2" onClick={onClose}>
                                <MessageSquare className="w-4 h-4" />
                                Go to chat
                            </Link>
                        </div>
                    ) : (
                        <>
                            <p className="text-xs text-fg-muted leading-relaxed">
                                Send a message to our admin team. You can edit it before sending. The first admin to reply will help you get full access.
                            </p>
                            {status.requestSentAt && (
                                <p className="text-[10px] font-bold uppercase tracking-widest text-warning">
                                    You already sent a request — sending again will notify all admins again.
                                </p>
                            )}
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={6}
                                className="input w-full resize-none text-sm leading-relaxed min-h-[140px]"
                                placeholder="Write your access request..."
                            />
                            {error && <p className="text-xs text-danger font-semibold">{error}</p>}
                            <button
                                type="button"
                                onClick={() => void handleSend()}
                                disabled={submitting || !message.trim()}
                                className={cn(
                                    "btn-primary w-full h-11 inline-flex items-center justify-center gap-2",
                                    submitting && "opacity-70"
                                )}
                            >
                                {submitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <MessageSquare className="w-4 h-4" />
                                )}
                                {submitting ? "Sending..." : "Send to admins"}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </ModalOverlay>
    );
}
