"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Plus, Dumbbell, Calendar, ChevronRight, Star,
    Trash2, Play, Share2, Check, PauseCircle, User, X, Loader2, HelpCircle,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { PLAN_TEMPLATES } from "@/lib/templates";
import { isCoachRole } from "@/lib/roles";
import { ActiveSessionBanner, type ActiveSessionInfo } from "@/components/shared/ActiveSessionBanner";
import { DeletePlanConfirmModal } from "@/components/shared/DeletePlanConfirmModal";
import { ModalOverlay } from "@/components/shared/ModalOverlay";

interface Plan {
    id: string;
    name: string;
    description?: string | null;
    type: string;
    shareCode?: string | null;
    creatorName: string;
    isOwned: boolean;
    isActive: boolean;
    isPublic?: boolean;
    weekCount: number;
    startedAt: string;
    tags: string[];
    assignedClient?: { id: string; name: string } | null;
}

interface Props {
    plans: Plan[];
    userRole: string;
    activeSession?: ActiveSessionInfo | null;
    coachClients?: { id: string; name: string }[];
}

const TEMPLATE_ICONS: Record<string, string> = {
    bro_split: "BRO",
    arnold: "ARN",
    ppl: "PPL",
    upper_lower: "UL",
    full_body: "FB",
    hybrid: "HYB",
};

const SHARE_CODE_HELP =
    "Enter an 8-character share code from an athlete or coach to instantly copy their workout plan into your account.";

function ShareCodeHelpButton() {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-subtle hover:text-brand-400 hover:bg-surface-muted transition-colors"
                aria-label="Share code help"
                aria-expanded={open}
                title={SHARE_CODE_HELP}
            >
                <HelpCircle className="w-4 h-4" />
            </button>
            {open && (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-40 cursor-default"
                        aria-label="Close help"
                        onClick={() => setOpen(false)}
                    />
                    <p className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-surface-border bg-surface-elevated p-3 text-[11px] leading-relaxed text-fg-muted shadow-modal">
                        {SHARE_CODE_HELP}
                    </p>
                </>
            )}
        </div>
    );
}

const PREBUILT_TEMPLATES = Object.values(PLAN_TEMPLATES).map((template) => ({
    id: template.id,
    name: template.name,
    desc: template.description,
    icon: TEMPLATE_ICONS[template.id] ?? "GYM",
}));

export function PlansClient({ plans, userRole, activeSession = null, coachClients = [] }: Props) {
    const isCoach = isCoachRole(userRole);
    const router = useRouter();
    const searchParams = useSearchParams();
    const highlightedPlanId = searchParams.get("highlight");
    const [tab, setTab] = useState<"mine" | "templates">("mine");
    const [code, setCode] = useState("");
    const [codeStatus, setCodeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [codeMsg, setCodeMsg] = useState("");
    const [planPendingDelete, setPlanPendingDelete] = useState<{
        id: string;
        name: string;
        isOwned: boolean;
    } | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [localPlans, setLocalPlans] = useState(plans);
    const [visibilitySavingId, setVisibilitySavingId] = useState<string | null>(null);
    const [assignPlan, setAssignPlan] = useState<{ id: string; name: string } | null>(null);
    const [assignClientId, setAssignClientId] = useState("");
    const [assignBusy, setAssignBusy] = useState(false);
    const [assignError, setAssignError] = useState<string | null>(null);
    // Activate-with-start-day modal
    const [activatePlan, setActivatePlan] = useState<{ id: string; name: string; weekCount: number } | null>(null);
    const [activateStartDay, setActivateStartDay] = useState<number | null>(null);
    const [activateBusy, setActivateBusy] = useState(false);

    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    function daysUntilWeekday(targetDow: number): number {
        const jsDow = new Date().getDay();
        const todayMon0 = jsDow === 0 ? 6 : jsDow - 1;
        let diff = targetDow - todayMon0;
        if (diff < 0) diff += 7;
        return diff;
    }

    const activePlan = localPlans.find((p) => p.isActive);
    const [localActiveSession, setLocalActiveSession] = useState(activeSession);
    const canPublishToProfile = !isCoach && localPlans.some((p) => p.isActive);

    const setActive = async (planId: string | null, weekStartDay?: number | null) => {
        await fetch("/api/plans/activate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planId, weekStartDay: weekStartDay ?? null }),
        });
        window.location.reload();
    };

    const togglePlanVisibility = async (planId: string, isPublic: boolean) => {
        setVisibilitySavingId(planId);
        try {
            const res = await fetch(`/api/plans/${planId}/visibility`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isPublic }),
            });
            if (!res.ok) {
                const data = await res.json();
                alert(data.error ?? "Could not update plan visibility");
                return;
            }
            setLocalPlans((prev) => prev.map((plan) => (
                plan.id === planId ? { ...plan, isPublic } : plan
            )));
        } catch {
            alert("Connection error");
        } finally {
            setVisibilitySavingId(null);
        }
    };

    const openAssignModal = (plan: Plan, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setAssignPlan({ id: plan.id, name: plan.name });
        setAssignClientId(coachClients[0]?.id ?? "");
        setAssignError(null);
    };

    const closeAssignModal = () => {
        if (assignBusy) return;
        setAssignPlan(null);
        setAssignClientId("");
        setAssignError(null);
    };

    const confirmAssignPlan = async () => {
        if (!assignPlan || !assignClientId) return;
        setAssignBusy(true);
        setAssignError(null);
        try {
            const res = await fetch("/api/coach/clients/plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: assignClientId, planId: assignPlan.id }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error ?? "Could not assign plan");

            const clientName = coachClients.find((c) => c.id === assignClientId)?.name ?? "Client";
            if (!data.cloned) {
                setLocalPlans((prev) => prev.map((plan) => (
                    plan.id === assignPlan.id
                        ? { ...plan, assignedClient: { id: assignClientId, name: clientName }, type: "COACH_ASSIGNED" }
                        : plan
                )));
            }
            setAssignPlan(null);
            setAssignClientId("");
            router.refresh();
        } catch (err) {
            setAssignError(err instanceof Error ? err.message : "Could not assign plan");
        } finally {
            setAssignBusy(false);
        }
    };

    const confirmDeletePlan = async () => {
        if (!planPendingDelete) return;

        const { id: planId, isOwned } = planPendingDelete;
        setDeleteBusy(true);
        try {
            const res = await fetch(`/api/plans/${planId}`, { method: "DELETE" });
            if (res.ok) {
                window.location.reload();
                return;
            }

            const data = await res.json().catch(() => ({}));
            const message =
                res.status === 409 && isOwned
                    ? `${data.error ?? "This plan has training history and cannot be deleted."}\n\nTip: Deactivate the plan or use "Remove from my plans" if you imported it — your logged sessions stay safe.`
                    : (data.error ?? "Failed to remove plan");
            alert(message);
        } finally {
            setDeleteBusy(false);
            setPlanPendingDelete(null);
        }
    };

    const importPlan = async () => {
        if (code.length !== 8 || codeStatus === "loading") return;
        setCodeStatus("loading");
        setCodeMsg("");
        const res = await fetch("/api/plans/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (res.ok) {
            setCodeStatus("success");
            setCodeMsg(`Imported from ${data.author}!`);
            setTimeout(() => window.location.reload(), 2000);
        } else {
            setCodeStatus("error");
            setCodeMsg(data.error ?? "Invalid code");
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <DeletePlanConfirmModal
                open={planPendingDelete !== null}
                planName={planPendingDelete?.name ?? ""}
                mode={planPendingDelete?.isOwned ? "delete" : "remove"}
                busy={deleteBusy}
                onClose={() => {
                    if (!deleteBusy) setPlanPendingDelete(null);
                }}
                onConfirm={confirmDeletePlan}
            />

            {/* Activate-with-start-day modal */}
            {activatePlan && (
                <ModalOverlay onClose={() => { if (!activateBusy) { setActivatePlan(null); setActivateStartDay(null); } }}>
                    <div
                        className="bg-surface-card w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-border">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Activate plan</p>
                                <h3 className="text-lg font-black text-fg truncate">{activatePlan.name}</h3>
                            </div>
                            <button type="button" onClick={() => { setActivatePlan(null); setActivateStartDay(null); }} disabled={activateBusy} className="btn-icon shrink-0">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            {activatePlan.weekCount > 1 && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">Week 1 Starts On</label>
                                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setActivateStartDay(null)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border transition-all",
                                                activateStartDay === null
                                                    ? "bg-brand-500/20 border-brand-500/50 text-brand-300"
                                                    : "bg-surface-elevated border-surface-border text-fg-subtle hover:text-fg hover:border-brand-600/40"
                                            )}
                                        >
                                            Right away
                                        </button>
                                        {DAYS.map((day, idx) => {
                                            const diff = daysUntilWeekday(idx);
                                            const isToday = diff === 0;
                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => setActivateStartDay(idx)}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border transition-all relative",
                                                        activateStartDay === idx
                                                            ? "bg-brand-500/20 border-brand-500/50 text-brand-300"
                                                            : "bg-surface-elevated border-surface-border text-fg-subtle hover:text-fg hover:border-brand-600/40"
                                                    )}
                                                >
                                                    {day}
                                                    {isToday && (
                                                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-brand-400" title="Today" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-fg-subtle">
                                        {activateStartDay === null
                                            ? "Week 1 starts immediately."
                                            : daysUntilWeekday(activateStartDay) === 0
                                                ? `Week 1 starts today (${DAYS_FULL[activateStartDay]}).`
                                                : `Week 1 starts ${DAYS_FULL[activateStartDay]} — ${daysUntilWeekday(activateStartDay)} day${daysUntilWeekday(activateStartDay) !== 1 ? "s" : ""} from now.`
                                        }
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-4 border-t border-surface-border flex gap-2">
                            <button type="button" onClick={() => { setActivatePlan(null); setActivateStartDay(null); }} disabled={activateBusy} className="btn-secondary flex-1">
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    setActivateBusy(true);
                                    await setActive(activatePlan.id, activateStartDay);
                                }}
                                disabled={activateBusy}
                                className="btn-primary flex-1 inline-flex items-center justify-center gap-2"
                            >
                                {activateBusy ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" />Activating…</>
                                ) : (
                                    "Activate"
                                )}
                            </button>
                        </div>
                    </div>
                </ModalOverlay>
            )}

            {assignPlan && (
                <ModalOverlay onClose={closeAssignModal}>
                    <div
                        className="bg-surface-card w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-border">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Assign plan</p>
                                <h3 className="text-lg font-black text-fg truncate">{assignPlan.name}</h3>
                            </div>
                            <button type="button" onClick={closeAssignModal} disabled={assignBusy} className="btn-icon shrink-0">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">Client</label>
                                <select
                                    className="input w-full mt-1.5"
                                    value={assignClientId}
                                    onChange={(e) => setAssignClientId(e.target.value)}
                                    disabled={assignBusy}
                                >
                                    {coachClients.map((client) => (
                                        <option key={client.id} value={client.id}>{client.name}</option>
                                    ))}
                                </select>
                            </div>
                            {assignError && (
                                <p className="text-xs font-medium text-danger">{assignError}</p>
                            )}
                        </div>
                        <div className="px-5 py-4 border-t border-surface-border flex gap-2">
                            <button type="button" onClick={closeAssignModal} disabled={assignBusy} className="btn-secondary flex-1">
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirmAssignPlan()}
                                disabled={assignBusy || !assignClientId}
                                className="btn-primary flex-1 inline-flex items-center justify-center gap-2"
                            >
                                {assignBusy ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Assigning…
                                    </>
                                ) : (
                                    "Assign plan"
                                )}
                            </button>
                        </div>
                    </div>
                </ModalOverlay>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="heading-2">Your Plans</h2>
                    <p className="subheading mt-1">
                        {isCoach
                            ? `${localPlans.length} programme${localPlans.length !== 1 ? "s" : ""}`
                            : `${localPlans.length} programme${localPlans.length !== 1 ? "s" : ""} saved`}
                    </p>
                </div>
                <Link href="/plans/create" className="btn-primary btn-sm">
                    <Plus className="w-4 h-4" />
                    New Plan
                </Link>
            </div>

            {localActiveSession && !isCoach && (
                <ActiveSessionBanner
                    session={localActiveSession}
                    onDiscarded={() => setLocalActiveSession(null)}
                />
            )}

            {/* Active plan banner */}
            {activePlan && (
                <div className="card p-5 border-brand-600/40 bg-brand-950/30 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-sm">
                            <Star className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-xs text-brand-400 font-semibold uppercase tracking-wider">Active Plan</p>
                            <p className="font-semibold text-fg">{activePlan.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActive(null)}
                            className="btn-ghost btn-sm text-fg-muted hover:text-danger"
                            title="Remove active plan"
                        >
                            <PauseCircle className="w-3.5 h-3.5" />
                            Remove
                        </button>
                        <Link href={`/plans/create?id=${activePlan.id}`} className="btn-secondary btn-sm">
                            Edit
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-surface-muted p-1 rounded-xl">
                {[
                    { id: "mine", label: "My Plans" },
                    { id: "templates", label: "Templates" },
                ].map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id as typeof tab)}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                            tab === t.id
                                ? "bg-surface-card text-fg shadow-card"
                                : "text-fg-muted hover:text-fg"
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Inline share code import */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-surface-border bg-surface-muted/40 px-3 py-2.5">
                <label htmlFor="plan-share-code" className="text-[10px] font-black uppercase tracking-widest text-fg-subtle shrink-0">
                    Share code
                </label>
                <div className="flex flex-1 min-w-0 items-center gap-2">
                    <input
                        id="plan-share-code"
                        placeholder="XXXXXXXX"
                        className="input h-9 w-full max-w-[9.5rem] font-mono text-xs font-bold uppercase tracking-widest"
                        value={code}
                        onChange={(e) => {
                            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
                            if (codeStatus !== "idle") {
                                setCodeStatus("idle");
                                setCodeMsg("");
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") void importPlan();
                        }}
                        maxLength={8}
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <button
                        type="button"
                        onClick={() => void importPlan()}
                        disabled={code.length !== 8 || codeStatus === "loading"}
                        className="btn-primary btn-sm h-9 shrink-0 px-4"
                    >
                        {codeStatus === "loading" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            "Import"
                        )}
                    </button>
                    <ShareCodeHelpButton />
                </div>
                {codeMsg && (
                    <p className={cn(
                        "w-full text-[11px] font-semibold",
                        codeStatus === "success" ? "text-success" : "text-danger"
                    )}>
                        {codeMsg}
                    </p>
                )}
            </div>

            {/* Tab: My Plans */}
            {tab === "mine" && (
                <div className="space-y-3">
                    {localPlans.length === 0 ? (
                        <div className="card p-12 text-center">
                            <Dumbbell className="w-10 h-10 text-fg-subtle mx-auto mb-3" />
                            <p className="font-semibold mb-1">No plans yet</p>
                            <p className="text-sm text-fg-muted mb-4">Create a custom plan or pick a template below.</p>
                            <div className="flex justify-center gap-3">
                                {isCoach ? (
                                    <Link href="/coach" className="btn-secondary btn-sm">Coach Panel</Link>
                                ) : (
                                    <Link href="/dashboard" className="btn-secondary btn-sm">Go to Dashboard</Link>
                                )}
                                <Link href="/plans/create" className="btn-primary btn-sm">Create Plan</Link>
                            </div>
                        </div>
                    ) : (
                        localPlans.map((plan) => (
                            <div key={plan.id} className={cn(
                                "card-hover p-0 overflow-hidden",
                                plan.isActive && "border-brand-600/40",
                                highlightedPlanId === plan.id && "ring-2 ring-brand-400 shadow-glow-brand-sm"
                            )}>
                                <div className="flex items-start justify-between p-5 gap-4">
                                    <Link href={`/plans/create?id=${plan.id}`} className="flex-1 min-w-0 flex items-start gap-4 hover:opacity-90">
                                        <div className="w-10 h-10 rounded-xl bg-surface-muted flex items-center justify-center flex-shrink-0">
                                            <Dumbbell className="w-5 h-5 text-brand-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-semibold text-fg truncate">{plan.name}</p>
                                                {plan.isActive && <span className="badge-brand text-[10px]">Active</span>}
                                                {!isCoach && plan.type === "COACH_ASSIGNED" && (
                                                    <span className="badge-success text-[10px]">Coach</span>
                                                )}
                                            </div>
                                            {plan.description && (
                                                <p className="text-sm text-fg-muted truncate">{plan.description}</p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-fg-subtle">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {plan.weekCount} weeks
                                                </span>
                                                {isCoach ? (
                                                    plan.assignedClient ? (
                                                        <Link
                                                            href={`/coach/client/${plan.assignedClient.id}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="flex items-center gap-1 text-brand-400 font-semibold hover:text-brand-300"
                                                        >
                                                            <User className="w-3 h-3" />
                                                            Assigned to {plan.assignedClient.name}
                                                        </Link>
                                                    ) : (
                                                        <span className="inline-flex flex-wrap items-center gap-2">
                                                            <span className="text-fg-muted">Not assigned</span>
                                                            {coachClients.length > 0 ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => openAssignModal(plan, e)}
                                                                    className="text-[10px] font-bold uppercase tracking-wide text-brand-400 hover:text-brand-300 px-2 py-0.5 rounded-md bg-brand-500/10 hover:bg-brand-500/15 transition-colors"
                                                                >
                                                                    Assign now
                                                                </button>
                                                            ) : (
                                                                <Link
                                                                    href="/coach/invites"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="text-[10px] font-bold uppercase tracking-wide text-brand-400 hover:text-brand-300 px-2 py-0.5 rounded-md bg-brand-500/10 hover:bg-brand-500/15 transition-colors"
                                                                >
                                                                    Assign now
                                                                </Link>
                                                            )}
                                                        </span>
                                                    )
                                                ) : (
                                                    <>
                                                        <span>Started {formatDate(plan.startedAt)}</span>
                                                        <span className="text-xs font-semibold text-brand-400">
                                                            Created by {plan.creatorName}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                    <div className="flex items-center gap-2 shrink-0 self-center">
                                        {!isCoach && (
                                            plan.isActive ? (
                                                <button
                                                    onClick={() => setActive(null)}
                                                    className="btn-ghost btn-sm text-fg-muted hover:text-danger"
                                                    title="Deactivate plan"
                                                >
                                                    <PauseCircle className="w-3.5 h-3.5" />
                                                    Deactivate
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setActivateStartDay(null);
                                                        setActivatePlan({ id: plan.id, name: plan.name, weekCount: plan.weekCount });
                                                    }}
                                                    className="btn-ghost btn-sm text-brand-400 hover:text-brand-300"
                                                >
                                                    <Play className="w-3.5 h-3.5" />
                                                    Activate
                                                </button>
                                            )
                                        )}
                                        <button
                                            onClick={() => setPlanPendingDelete({
                                                id: plan.id,
                                                name: plan.name,
                                                isOwned: plan.isOwned,
                                            })}
                                            className="btn-icon w-8 h-8 rounded-lg transition-all hover:bg-danger/10 hover:text-danger text-fg-subtle"
                                            title={plan.isOwned ? "Delete plan" : "Remove from my plans"}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="px-5 pb-5 border-t border-surface-border/20 pt-3 flex items-center gap-2">
                                    <div className="flex items-center gap-2 bg-surface-muted border border-surface-border rounded-xl px-3 py-2 flex-1 min-w-0">
                                        <Share2 className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                                        <span className="font-mono font-black text-brand-300 text-xs tracking-widest uppercase">{plan.shareCode}</span>
                                        <span className="text-[10px] text-fg-subtle ml-1">— Share this code</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (!plan.shareCode) return;
                                            navigator.clipboard.writeText(plan.shareCode);
                                            setCopiedId(plan.id);
                                            setTimeout(() => setCopiedId(null), 2000);
                                        }}
                                        disabled={!plan.shareCode}
                                        className={cn(
                                            "btn-sm flex items-center gap-1.5 transition-all shrink-0",
                                            copiedId === plan.id
                                                ? "bg-success/10 text-success border border-success/30"
                                                : "btn-secondary"
                                        )}
                                    >
                                        {copiedId === plan.id ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                                        {copiedId === plan.id ? "Copied!" : "Copy"}
                                    </button>
                                </div>

                                {canPublishToProfile && plan.isOwned && plan.type === "USER_CREATED" && (
                                    <div className="px-5 pb-5 border-t border-surface-border/20 pt-3 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-black text-fg">Public on profile</p>
                                            <p className="text-[10px] text-fg-muted mt-0.5">Let others copy this plan from your public profile</p>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={Boolean(plan.isPublic)}
                                            disabled={visibilitySavingId === plan.id}
                                            onClick={() => togglePlanVisibility(plan.id, !plan.isPublic)}
                                            className={cn(
                                                "relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50",
                                                plan.isPublic ? "bg-brand-500" : "bg-surface-muted border border-surface-border"
                                            )}
                                        >
                                            <span className={cn(
                                                "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform",
                                                plan.isPublic && "translate-x-5"
                                            )} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Tab: Templates */}
            {tab === "templates" && (
                <div className="grid sm:grid-cols-2 gap-4">
                    {PREBUILT_TEMPLATES.map((t) => (
                        <div key={t.id} className="card-hover p-5">
                            <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-brand-500/10 px-2 text-xs font-black tracking-widest text-brand-300">{t.icon}</span>
                            <h3 className="font-semibold mt-3 mb-1">{t.name}</h3>
                            <p className="text-sm text-fg-muted mb-4">{t.desc}</p>
                            <Link
                                href={`/plans/create?template=${t.id}`}
                                className="btn-secondary btn-sm"
                            >
                                Use Template
                                <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
}
