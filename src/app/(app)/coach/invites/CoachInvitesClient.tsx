"use client";

import { useState } from "react";
import { 
    Ticket, Plus, Copy, Check, Trash2, 
    Calendar, UserPlus, Shield, ExternalLink 
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import Link from "next/link";

interface Code {
    id: string;
    code: string;
    planName: string | null;
    usedByName: string | null;
    usedByEmail: string | null;
    isActive: boolean;
    createdAt: string;
    expiresAt: string | null;
    upgradesTo: string;
}

interface Plan {
    id: string;
    name: string;
}

interface Props {
    plans: Plan[];
    initialCodes: Code[];
}

export function CoachInvitesClient({ plans, initialCodes }: Props) {
    const [codes, setCodes] = useState<Code[]>(initialCodes);
    const [generating, setGenerating] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState("");
    const [newCode, setNewCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const generateInvite = async () => {
        setGenerating(true);
        try {
            const res = await fetch("/api/codes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    planId: selectedPlanId || undefined,
                    upgradesTo: "PREMIUM" // Coaches usually only invite Premium clients
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setNewCode(data.code);
                // Refresh list
                const refreshRes = await fetch("/api/codes?filter=ALL");
                if (refreshRes.ok) {
                    const latest = await refreshRes.json();
                    setCodes(latest.map((c: any) => ({
                        id: c.id,
                        code: c.code,
                        planName: c.planName,
                        usedByName: c.usedByName,
                        usedByEmail: c.usedByEmail,
                        isActive: c.isActive,
                        createdAt: c.createdAt,
                        expiresAt: c.expiresAt ?? null,
                        upgradesTo: c.upgradesTo
                    })));
                }
            }
        } finally {
            setGenerating(false);
        }
    };

    const deleteCode = async (id: string) => {
        if (!confirm("Are you sure you want to cancel this invite code? It will no longer be valid.")) return;
        try {
            const res = await fetch("/api/codes", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (res.ok) {
                setCodes(codes.filter(c => c.id !== id));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const copyCode = () => {
        if (newCode) {
            navigator.clipboard.writeText(newCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Action Card */}
            <div className="card-hover p-6 border-brand-500/30 bg-gradient-to-br from-surface-card to-brand-950/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="w-12 h-12 bg-brand-400/10 rounded-2xl flex items-center justify-center mb-2">
                            <UserPlus className="w-6 h-6 text-brand-400" />
                        </div>
                        <h3 className="text-xl font-black text-fg tracking-tight uppercase">Invite New Athlete</h3>
                        <p className="text-sm text-fg-muted max-w-md">
                            Generate a unique access code to onboard a new client. You can optionally pre-assign one of your custom training plans.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 min-w-[300px]">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-brand-400/80 ml-1">Attach Training Plan</label>
                            <select 
                                className="input h-11 text-sm bg-surface-muted/50"
                                value={selectedPlanId}
                                onChange={(e) => setSelectedPlanId(e.target.value)}
                            >
                                <option value="">No Plan (Blank Slate)</option>
                                {plans.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={generateInvite}
                            disabled={generating}
                            className="btn-primary h-12 shadow-glow-brand flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[11px]"
                        >
                            {generating ? (
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4" />
                            )}
                            {generating ? "Authorizing..." : "Create Invite Code"}
                        </button>
                    </div>
                </div>

                {newCode && (
                    <div className="mt-8 p-4 bg-brand-950/40 border-2 border-brand-500/40 rounded-2xl animate-slide-up">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em] mb-1">Your Unique Invite Code</p>
                                <p className="text-3xl font-mono font-black text-brand-300 tracking-[0.3em]">{newCode}</p>
                            </div>
                            <button 
                                onClick={copyCode}
                                className={cn(
                                    "btn-sm h-12 px-6 flex items-center gap-3 transition-all",
                                    copied ? "bg-success/10 text-success border border-success/30" : "btn-secondary"
                                )}
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copied ? "Copied To Clipboard" : "Copy Code"}
                            </button>
                        </div>
                        <p className="text-[10px] text-fg-subtle mt-4 text-center border-t border-brand-900 pt-3">
                            Send this code to your athlete. It will expire once they use it to join your stable.
                        </p>
                    </div>
                )}
            </div>

            {/* List Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="heading-3">Invites History</h3>
                    <div className="flex items-center gap-2">
                        <span className="badge-brand">{codes.filter(c => c.isActive && !c.usedByName).length} Pending</span>
                    </div>
                </div>

                <div className="grid gap-3">
                    {codes.length === 0 ? (
                        <div className="card p-12 text-center border-dashed">
                            <Ticket className="w-10 h-10 text-fg-subtle mx-auto mb-3 opacity-20" />
                            <p className="text-fg-muted font-medium">No invite codes generated yet.</p>
                        </div>
                    ) : (
                        [...codes]
                        .sort((a, b) => {
                            // Deployed (active + used) first
                            const aDeployed = a.isActive && a.usedByName;
                            const bDeployed = b.isActive && b.usedByName;
                            if (aDeployed && !bDeployed) return -1;
                            if (!aDeployed && bDeployed) return 1;
                            
                            // Then Active (active + not used)
                            const aActive = a.isActive && !a.usedByName;
                            const bActive = b.isActive && !b.usedByName;
                            if (aActive && !bActive) return -1;
                            if (!aActive && bActive) return 1;
                            
                            // Then everything else (inactive)
                            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                        })
                        .map((c) => (
                            <div key={c.id} className={cn(
                                "card p-4 group transition-all",
                                c.isActive ? "hover:border-brand-600/20" : "opacity-60 grayscale-[0.5]"
                            )}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center border",
                                            c.isActive 
                                                ? (c.usedByName ? "bg-success-500/10 border-success-500/20 text-success" : "bg-brand-500/10 border-brand-500/20 text-brand-400")
                                                : "bg-surface-muted border-surface-border text-fg-subtle"
                                        )}>
                                            <Shield className="w-5 h-5 opacity-80" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-mono font-bold text-fg tracking-widest">{c.code}</p>
                                                {c.isActive ? (
                                                    c.usedByName ? (
                                                        <span className="badge-success text-[9px]">Deployed</span>
                                                    ) : (
                                                        <span className="badge-brand text-[9px]">Active</span>
                                                    )
                                                ) : (
                                                    <span className="badge-muted text-[9px] bg-danger/10 text-danger border-danger/20">Revoked</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest mt-0.5">
                                                {c.planName ? `Plan: ${c.planName}` : "General Invite"} • {formatDate(c.createdAt)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right flex items-center gap-4">
                                        {c.usedByName ? (
                                            <div className="flex flex-col items-end">
                                                <p className="text-xs font-bold text-fg">{c.usedByName}</p>
                                                <p className="text-[10px] text-fg-subtle">{c.usedByEmail}</p>
                                            </div>
                                        ) : (
                                            c.isActive ? (
                                                <>
                                                    <p className="text-[10px] text-brand-400/60 font-black uppercase tracking-widest">
                                                        Waiting for claim...
                                                    </p>
                                                    <button 
                                                        onClick={() => deleteCode(c.id)}
                                                        className="btn-icon w-8 h-8 rounded-lg text-danger/50 hover:text-danger hover:bg-danger/10 transition-all ml-2"
                                                        title="Cancel Code"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <p className="text-[10px] text-fg-subtle font-black uppercase tracking-widest italic">
                                                    Invite Expired
                                                </p>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
