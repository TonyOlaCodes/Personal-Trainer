"use client";

import { useState } from "react";
import { ClipboardList, Dumbbell, Megaphone, X } from "lucide-react";
import { ModalOverlay } from "@/components/shared/ModalOverlay";
import { cn } from "@/lib/utils";
import { formatCoachPlanLabel, type CoachPlanRecord } from "@/lib/coachPlans";

interface ConversationOption {
    userId: string;
    name: string;
    isDeleted?: boolean;
}

interface Props {
    conversations: ConversationOption[];
    coachPlans: CoachPlanRecord[];
    selectedClientId?: string | null;
    onComplete?: () => void;
}

type ModalKind = "plan" | "checkin" | "broadcast" | null;

export function CoachChatTools({ conversations, coachPlans, selectedClientId, onComplete }: Props) {
    const [modal, setModal] = useState<ModalKind>(null);
    const [planId, setPlanId] = useState("");
    const [note, setNote] = useState("");
    const [broadcastMode, setBroadcastMode] = useState<"all" | "selected">("all");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [broadcastText, setBroadcastText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const activeClients = conversations.filter((c) => !c.isDeleted);

    const closeModal = () => {
        setModal(null);
        setNote("");
        setPlanId("");
        setBroadcastText("");
        setBroadcastMode("all");
        setSelectedIds([]);
        setError(null);
    };

    const openPlan = () => {
        setPlanId(coachPlans[0]?.id ?? "");
        setNote("");
        setError(null);
        setModal("plan");
    };

    const openCheckIn = () => {
        setNote("");
        setError(null);
        setModal("checkin");
    };

    const openBroadcast = () => {
        setBroadcastText("");
        setBroadcastMode("all");
        setSelectedIds([]);
        setError(null);
        setModal("broadcast");
    };

    const toggleClient = (userId: string) => {
        setSelectedIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const handleSendPlan = async () => {
        if (!selectedClientId || !planId) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/coach/chat/send-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: selectedClientId,
                    planId,
                    note: note.trim() || undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error ?? "Failed to send plan");
            closeModal();
            onComplete?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send plan");
        } finally {
            setSubmitting(false);
        }
    };

    const handleRequestCheckIn = async () => {
        if (!selectedClientId) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/coach/chat/request-checkin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: selectedClientId,
                    note: note.trim() || undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error ?? "Failed to send check-in request");
            closeModal();
            onComplete?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send check-in request");
        } finally {
            setSubmitting(false);
        }
    };

    const handleBroadcast = async () => {
        if (!broadcastText.trim()) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/coach/chat/broadcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: broadcastText.trim(),
                    clientIds: broadcastMode === "selected" ? selectedIds : undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error ?? "Failed to broadcast message");
            closeModal();
            onComplete?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to broadcast message");
        } finally {
            setSubmitting(false);
        }
    };

    const canDirectAction = Boolean(selectedClientId && activeClients.some((c) => c.userId === selectedClientId));

    return (
        <>
            <div className="flex flex-wrap items-center gap-1.5">
                {canDirectAction && (
                    <>
                        <button
                            type="button"
                            onClick={openPlan}
                            disabled={coachPlans.length === 0}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-colors disabled:opacity-40"
                            title="Send workout plan"
                        >
                            <Dumbbell className="w-3.5 h-3.5" />
                            Plan
                        </button>
                        <button
                            type="button"
                            onClick={openCheckIn}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-surface-muted text-fg-muted hover:text-fg hover:bg-surface-elevated transition-colors"
                            title="Request check-in"
                        >
                            <ClipboardList className="w-3.5 h-3.5" />
                            Check-in
                        </button>
                    </>
                )}
                <button
                    type="button"
                    onClick={openBroadcast}
                    disabled={activeClients.length === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning hover:bg-warning/20 transition-colors disabled:opacity-40"
                    title="Broadcast to clients"
                >
                    <Megaphone className="w-3.5 h-3.5" />
                    Broadcast
                </button>
            </div>

            {modal && (
                <ModalOverlay onClose={closeModal}>
                    <div
                        className="bg-surface-card w-full sm:max-w-md max-h-[85vh] rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-border shrink-0">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Coach Chat</p>
                                <h3 className="text-lg font-black text-fg truncate">
                                    {modal === "plan" && "Send Workout Plan"}
                                    {modal === "checkin" && "Request Check-In"}
                                    {modal === "broadcast" && "Broadcast Message"}
                                </h3>
                            </div>
                            <button type="button" onClick={closeModal} className="btn-icon shrink-0">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4 min-h-0">
                            {modal === "plan" && (
                                <>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">Plan</label>
                                        <select
                                            className="input w-full mt-1.5"
                                            value={planId}
                                            onChange={(e) => setPlanId(e.target.value)}
                                        >
                                            {coachPlans.map((plan) => (
                                                <option key={plan.id} value={plan.id}>
                                                    {formatCoachPlanLabel(plan)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">Optional note</label>
                                        <textarea
                                            className="input w-full mt-1.5 min-h-[80px] resize-none"
                                            placeholder="Add a personal note with the plan..."
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            maxLength={500}
                                        />
                                    </div>
                                </>
                            )}

                            {modal === "checkin" && (
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">Optional note</label>
                                    <textarea
                                        className="input w-full mt-1.5 min-h-[80px] resize-none"
                                        placeholder="Ask about sleep, nutrition, or how training is going..."
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        maxLength={500}
                                    />
                                </div>
                            )}

                            {modal === "broadcast" && (
                                <>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setBroadcastMode("all")}
                                            className={cn(
                                                "flex-1 py-2 rounded-xl text-xs font-bold transition-colors border",
                                                broadcastMode === "all"
                                                    ? "bg-brand-500/10 border-brand-500/30 text-brand-400"
                                                    : "border-surface-border text-fg-muted hover:bg-surface-muted"
                                            )}
                                        >
                                            All clients ({activeClients.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setBroadcastMode("selected")}
                                            className={cn(
                                                "flex-1 py-2 rounded-xl text-xs font-bold transition-colors border",
                                                broadcastMode === "selected"
                                                    ? "bg-brand-500/10 border-brand-500/30 text-brand-400"
                                                    : "border-surface-border text-fg-muted hover:bg-surface-muted"
                                            )}
                                        >
                                            Selected only
                                        </button>
                                    </div>

                                    {broadcastMode === "selected" && (
                                        <div className="max-h-40 overflow-y-auto rounded-xl border border-surface-border divide-y divide-surface-border">
                                            {activeClients.map((client) => (
                                                <label
                                                    key={client.userId}
                                                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-muted/40"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(client.userId)}
                                                        onChange={() => toggleClient(client.userId)}
                                                        className="rounded border-surface-border"
                                                    />
                                                    <span className="text-sm font-medium text-fg truncate">{client.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">Message</label>
                                        <textarea
                                            className="input w-full mt-1.5 min-h-[100px] resize-none"
                                            placeholder="Message all selected clients..."
                                            value={broadcastText}
                                            onChange={(e) => setBroadcastText(e.target.value)}
                                            maxLength={2000}
                                        />
                                    </div>
                                </>
                            )}

                            {error && (
                                <p className="text-xs font-medium text-danger">{error}</p>
                            )}
                        </div>

                        <div className="px-5 py-4 border-t border-surface-border shrink-0 flex gap-2">
                            <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={
                                    submitting
                                    || (modal === "plan" && !planId)
                                    || (modal === "broadcast" && (!broadcastText.trim() || (broadcastMode === "selected" && selectedIds.length === 0)))
                                }
                                onClick={() => {
                                    if (modal === "plan") void handleSendPlan();
                                    else if (modal === "checkin") void handleRequestCheckIn();
                                    else if (modal === "broadcast") void handleBroadcast();
                                }}
                                className="btn-primary flex-1"
                            >
                                {submitting ? "Sending..." : modal === "broadcast" ? "Send broadcast" : "Send in chat"}
                            </button>
                        </div>
                    </div>
                </ModalOverlay>
            )}
        </>
    );
}
