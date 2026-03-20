"use client";

import { useState } from "react";
import Link from "next/link";
import {
    Plus, Dumbbell, Calendar, ChevronRight, Star,
    MoreVertical, Trash2, Play, Ticket,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { PremiumLockScreen } from "@/components/shared/PremiumLockScreen";

interface Plan {
    id: string;
    name: string;
    description?: string | null;
    type: string;
    isActive: boolean;
    weekCount: number;
    startedAt: string;
    tags: string[];
}

interface Props {
    plans: Plan[];
    userRole: string;
}

const PREBUILT_TEMPLATES = [
    { id: "ppl", name: "PPL (Push Pull Legs)", desc: "3-day or 6-day split hitting each muscle 2x/wk", icon: "💪" },
    { id: "pplul", name: "PPL/Upper Lower", desc: "5-day hybrid: PPL + Upper Lower for frequency", icon: "⚡" },
    { id: "arnold", name: "Arnold Split", desc: "6-day chest/back, shoulders/arms, legs split", icon: "🏆" },
    { id: "bro", name: "Bro Split", desc: "Classic 5-day one-muscle-per-day programme", icon: "🔥" },
];

export function PlansClient({ plans, userRole }: Props) {
    const [tab, setTab] = useState<"mine" | "templates" | "code">("mine");
    const [code, setCode] = useState("");
    const [codeStatus, setCodeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [codeMsg, setCodeMsg] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const activePlan = plans.find((p) => p.isActive);

    const setActive = async (planId: string) => {
        await fetch("/api/plans/activate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planId }),
        });
        window.location.reload();
    };

    const deletePlan = async (planId: string) => {
        if (deletingId !== planId) {
            setDeletingId(planId);
            return;
        }
        
        const res = await fetch(`/api/plans/${planId}`, { method: "DELETE" });
        if (res.ok) {
            window.location.reload();
        } else {
            alert("Failed to delete plan");
            setDeletingId(null);
        }
    };

    const redeemCode = async () => {
        setCodeStatus("loading");
        const res = await fetch("/api/codes/redeem", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (res.ok) {
            setCodeStatus("success");
            setCodeMsg("Code redeemed! Plan assigned and account upgraded.");
            setTimeout(() => window.location.reload(), 1500);
        } else {
            setCodeStatus("error");
            setCodeMsg(data.error ?? "Invalid code");
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="heading-2">Your Plans</h2>
                    <p className="subheading mt-1">{plans.length} programme{plans.length !== 1 ? "s" : ""} saved</p>
                </div>
                <Link href="/plans/create" className="btn-primary btn-sm">
                    <Plus className="w-4 h-4" />
                    New Plan
                </Link>
            </div>

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
                    <Link href={`/plans/create?id=${activePlan.id}`} className="btn-secondary btn-sm">
                        Edit
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-surface-muted p-1 rounded-xl">
                {[
                    { id: "mine", label: "My Plans" },
                    { id: "templates", label: "Templates" },
                    { id: "code", label: "Use Code", icon: Ticket },
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
                        {t.icon && <t.icon className="w-3.5 h-3.5" />}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab: My Plans */}
            {tab === "mine" && (
                <div className="space-y-3">
                    {plans.length === 0 ? (
                        <div className="card p-12 text-center">
                            <Dumbbell className="w-10 h-10 text-fg-subtle mx-auto mb-3" />
                            <p className="font-semibold mb-1">No plans yet</p>
                            <p className="text-sm text-fg-muted mb-4">Create a custom plan or pick a template below.</p>
                            <div className="flex justify-center gap-3">
                                <Link href="/" className="btn-secondary btn-sm">Main Menu</Link>
                                <Link href="/plans/create" className="btn-primary btn-sm">Create Plan</Link>
                            </div>
                        </div>
                    ) : (
                        plans.map((plan) => (
                            <div key={plan.id} className={cn("card-hover p-5", plan.isActive && "border-brand-600/40")}>
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-surface-muted flex items-center justify-center flex-shrink-0">
                                        <Dumbbell className="w-5 h-5 text-brand-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold text-fg truncate">{plan.name}</p>
                                            {plan.isActive && <span className="badge-brand text-[10px]">Active</span>}
                                            {plan.type === "COACH_ASSIGNED" && <span className="badge-success text-[10px]">Coach</span>}
                                        </div>
                                        {plan.description && (
                                            <p className="text-sm text-fg-muted truncate">{plan.description}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-2 text-xs text-fg-subtle">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {plan.weekCount} weeks
                                            </span>
                                            <span>Started {formatDate(plan.startedAt)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!plan.isActive && (
                                            <button
                                                onClick={() => setActive(plan.id)}
                                                className="btn-ghost btn-sm text-brand-400 hover:text-brand-300"
                                            >
                                                <Play className="w-3.5 h-3.5" />
                                                Activate
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deletePlan(plan.id)}
                                            className={cn(
                                                "btn-icon w-8 h-8 rounded-lg transition-all",
                                                deletingId === plan.id ? "bg-danger text-white scale-110 shadow-glow-sm" : "hover:bg-danger/10 hover:text-danger text-fg-subtle"
                                            )}
                                            title={deletingId === plan.id ? "Confirm Delete?" : "Delete Plan"}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <Link href={`/plans/create?id=${plan.id}`} className="btn-ghost btn-sm">
                                            <ChevronRight className="w-4 h-4" />
                                        </Link>
                                    </div>
                                </div>
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
                            <span className="text-3xl">{t.icon}</span>
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

            {/* Tab: Access Code */}
            {tab === "code" && (
                <div className="pt-4">
                    <PremiumLockScreen 
                        title="Redeem Access Code" 
                        description="Enter a code from your coach to unlock a tailored plan and automatically upgrade your account to Premium."
                    />
                </div>
            )}
        </div>
    );
}
