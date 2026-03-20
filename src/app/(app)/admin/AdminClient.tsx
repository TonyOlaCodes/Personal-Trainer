"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, Dumbbell, Ticket, Shield, Copy, Check, ChevronRight, Plus, Trash2 } from "lucide-react";
import { cn, formatDate, roleLabels, roleBadgeClass } from "@/lib/utils";

interface AdminUser {
    id: string;
    name?: string | null;
    email: string;
    role: string;
    createdAt: string;
    onboardingDone: boolean;
}

interface AdminPlan {
    id: string;
    name: string;
    type: string;
    userCount: number;
}

interface AdminCode {
    id: string;
    code: string;
    planName?: string | null;
    usedBy?: string | null;
    usedById?: string | null;
    isActive: boolean;
    createdAt: string;
    expiresAt?: string | null;
}

interface Props {
    users: AdminUser[];
    plans: AdminPlan[];
    codes: AdminCode[];
    userRole: string;
}

type Tab = "users" | "plans" | "codes";
type CodeFilter = "ALL" | "ACTIVE" | "USED" | "EXPIRED";

export function AdminClient({ users, plans, codes: initialCodes, userRole }: Props) {
    const [tab, setTab] = useState<Tab>("users");
    const [codes, setCodes] = useState<AdminCode[]>(initialCodes);
    const [codeFilter, setCodeFilter] = useState<CodeFilter>("ALL");
    const [generatingCode, setGeneratingCode] = useState(false);
    const [deletingCodeId, setDeletingCodeId] = useState<string | null>(null);
    const [newCode, setNewCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<string>("");
    const [selectedRole, setSelectedRole] = useState<string>("PREMIUM");
    const [selectedExpiresIn, setSelectedExpiresIn] = useState<string>("0");
    const [promotingId, setPromotingId] = useState<string | null>(null);

    const generateCode = async () => {
        setGeneratingCode(true);
        const res = await fetch("/api/codes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                planId: selectedPlanId || undefined, 
                upgradesTo: selectedRole,
                expiresInHours: selectedExpiresIn !== "0" ? parseInt(selectedExpiresIn) : undefined
            }),
        });
        if (res.ok) {
            const data = await res.json();
            setNewCode(data.code);
            // Refresh codes
            const refreshRes = await fetch("/api/codes");
            if (refreshRes.ok) setCodes(await refreshRes.json());
        }
        setGeneratingCode(false);
    };

    const deleteCode = async (id: string) => {
        if (!confirm("Are you sure you want to delete this access code?")) return;
        setDeletingCodeId(id);
        const res = await fetch("/api/codes", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });
        if (res.ok) {
            setCodes(codes.filter(c => c.id !== id));
        }
        setDeletingCodeId(null);
    };

    const filteredCodes = codes.filter(c => {
        if (codeFilter === "ALL") return true;
        if (codeFilter === "ACTIVE") return c.isActive && (!c.expiresAt || new Date(c.expiresAt) > new Date());
        if (codeFilter === "USED") return !!c.usedBy;
        if (codeFilter === "EXPIRED") return c.expiresAt && new Date(c.expiresAt) < new Date();
        return true;
    });

    const copyCode = () => {
        if (newCode) {
            navigator.clipboard.writeText(newCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const promoteUser = async (userId: string, role: string) => {
        setPromotingId(userId);
        await fetch("/api/admin/users/role", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, role }),
        });
        setPromotingId(null);
        window.location.reload();
    };

    const stats = [
        { label: "Total Users", val: users.length, icon: Users, color: "text-brand-400" },
        { label: "Premium Users", val: users.filter(u => u.role === "PREMIUM").length, icon: Shield, color: "text-success" },
        { label: "Coaches", val: users.filter(u => u.role === "COACH").length, icon: Users, color: "text-warning" },
        { label: "Active Codes", val: codes.filter(c => c.isActive).length, icon: Ticket, color: "text-brand-300" },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {stats.map((s) => (
                    <div key={s.label} className="stat-card">
                        <s.icon className={`w-4 h-4 ${s.color} mb-1`} />
                        <p className="stat-value">{s.val}</p>
                        <p className="stat-label">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-surface-muted p-1 rounded-xl">
                {[
                    { id: "users", label: "Users", icon: Users },
                    { id: "plans", label: "Plans", icon: Dumbbell },
                    { id: "codes", label: "Codes", icon: Ticket },
                ].map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id as Tab)}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
                            tab === t.id ? "bg-surface-card text-fg shadow-card" : "text-fg-muted hover:text-fg"
                        )}
                    >
                        <t.icon className="w-3.5 h-3.5" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab: Users */}
            {tab === "users" && (
                <div className="card overflow-hidden">
                    <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
                        <h3 className="heading-3">All Users</h3>
                        <p className="text-xs text-fg-muted">{users.length} total</p>
                    </div>
                    <div className="divide-y divide-surface-border">
                        {users.map((u) => (
                            <div key={u.id} className="flex items-center justify-between px-5 py-3.5">
                                <div>
                                    <p className="font-medium text-sm text-fg">{u.name ?? "No name"}</p>
                                    <p className="text-xs text-fg-muted">{u.email}</p>
                                    <p className="text-xs text-fg-subtle">{formatDate(u.createdAt)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={roleBadgeClass[u.role]}>{roleLabels[u.role]}</span>
                                    {u.role === "FREE" && (
                                        <button
                                            onClick={() => promoteUser(u.id, "COACH")}
                                            disabled={promotingId === u.id}
                                            className="btn-ghost btn-sm text-xs"
                                        >
                                            → Coach
                                        </button>
                                    )}
                                    {u.role !== "SUPER_ADMIN" && (
                                        <button
                                            onClick={() => promoteUser(u.id, "SUPER_ADMIN")}
                                            disabled={promotingId === u.id}
                                            className="btn-ghost btn-sm text-xs text-warning"
                                        >
                                            → Admin
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab: Plans */}
            {tab === "plans" && (
                <div className="card overflow-hidden">
                    <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
                        <h3 className="heading-3">All Plans</h3>
                    </div>
                    <div className="divide-y divide-surface-border">
                        {plans.map((p) => (
                            <div key={p.id} className="flex items-center justify-between px-5 py-3.5">
                                <div>
                                    <p className="font-medium text-sm text-fg">{p.name}</p>
                                    <p className="text-xs text-fg-muted">{p.type.replace("_", " ")}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-fg-muted">{p.userCount} users</span>
                                    <ChevronRight className="w-4 h-4 text-fg-subtle" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab: Codes */}
            {tab === "codes" && (
                <div className="space-y-4">
                    {/* Generate code */}
                    <div className="card p-5">
                        <h3 className="heading-3 mb-4">Generate Access Code</h3>
                        <div className="flex flex-col md:flex-row gap-3">
                            <select
                                className="input flex-1"
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                            >
                                <option value="PREMIUM">Premium Member Code</option>
                                {userRole === "SUPER_ADMIN" && <option value="COACH">Coach Code</option>}
                            </select>
                            <select
                                className="input flex-1"
                                value={selectedPlanId}
                                onChange={(e) => setSelectedPlanId(e.target.value)}
                            >
                                <option value="">No specific plan (Open)</option>
                                {plans.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <select
                                className="input flex-1"
                                value={selectedExpiresIn}
                                onChange={(e) => setSelectedExpiresIn(e.target.value)}
                            >
                                <option value="0">Never Expires</option>
                                <option value="24">Expires in 24h</option>
                                <option value="48">Expires in 48h</option>
                                <option value="72">Expires in 72h</option>
                            </select>
                            <button onClick={generateCode} disabled={generatingCode} className="btn-primary">
                                <Plus className="w-4 h-4" />
                                {generatingCode ? "Wait..." : "Generate"}
                            </button>
                        </div>

                        {newCode && (
                            <div className="mt-4 flex items-center gap-3 p-4 bg-brand-950/40 border border-brand-700/40 rounded-xl animate-fade-in">
                                <p className="font-mono font-bold text-2xl text-brand-300 tracking-widest flex-1">{newCode}</p>
                                <button onClick={copyCode} className="btn-secondary btn-sm">
                                    {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                                    {copied ? "Copied!" : "Copy"}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Codes table */}
                    <div className="card overflow-hidden">
                        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
                            <h3 className="heading-3">Access Codes ({filteredCodes.length})</h3>
                            <div className="flex gap-1 bg-surface-muted p-1 rounded-lg border border-surface-border">
                                {(["ALL", "ACTIVE", "USED", "EXPIRED"] as CodeFilter[]).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setCodeFilter(f)}
                                        className={cn(
                                            "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                                            codeFilter === f ? "bg-surface-card text-brand-400 shadow-sm" : "text-fg-subtle hover:text-fg"
                                        )}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="divide-y divide-surface-border bg-surface-card/20 backdrop-blur-sm">
                            {filteredCodes.length === 0 ? (
                                <div className="p-10 text-center">
                                    <p className="text-sm text-fg-muted italic">No codes matching this status.</p>
                                </div>
                            ) : filteredCodes.map((c) => (
                                <div key={c.id} className="flex items-center justify-between px-5 py-4 group hover:bg-surface-muted/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm",
                                            c.isActive ? "bg-brand-500/10 border-brand-500/20 text-brand-400" : "bg-surface-muted border-surface-border text-fg-subtle"
                                        )}>
                                            <Ticket className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-mono font-black text-sm text-fg tracking-[0.2em]">{c.code}</p>
                                                <span className={cn(
                                                    "text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest",
                                                    (c as any).upgradesTo === "COACH" ? "bg-warning-500/10 text-warning border border-warning/20" : "bg-brand-500/10 text-brand-400 border border-brand/20"
                                                )}>
                                                    {(c as any).upgradesTo === "COACH" ? "Coach" : "Member"}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest mt-1">
                                                {c.planName ? c.planName : "Open Entry"} · {formatDate(c.createdAt)}
                                                {c.expiresAt && <span className="text-warning ml-2">Exp: {formatDate(c.expiresAt)}</span>}
                                            </p>
                                            {c.usedBy && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                                    {c.usedById ? (
                                                        <Link 
                                                            href={`/coach/client/${c.usedById}`}
                                                            className="text-[10px] font-black text-success uppercase tracking-widest hover:underline"
                                                        >
                                                            Claimed: {c.usedBy}
                                                        </Link>
                                                    ) : (
                                                        <p className="text-[10px] font-black text-success uppercase tracking-widest">Claimed: {c.usedBy}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right flex flex-col items-end">
                                            {c.isActive && (!c.expiresAt || new Date(c.expiresAt) > new Date()) ? (
                                                <span className="text-[10px] font-black bg-brand-500/10 text-brand-400 px-2 py-0.5 rounded uppercase tracking-tighter">Authorized</span>
                                            ) : c.usedBy ? (
                                                <span className="text-[10px] font-black bg-success-500/10 text-success px-2 py-0.5 rounded uppercase tracking-tighter">Deployed</span>
                                            ) : (
                                                <span className="text-[10px] font-black bg-danger-500/10 text-danger px-2 py-0.5 rounded uppercase tracking-tighter">Expired/Revoked</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => deleteCode(c.id)}
                                            disabled={deletingCodeId === c.id}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-subtle hover:bg-danger-muted/20 hover:text-danger opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                                            title="Revoke and Purge Code"
                                        >
                                            <Trash2 className={cn("w-4 h-4", deletingCodeId === c.id && "animate-spin")} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

