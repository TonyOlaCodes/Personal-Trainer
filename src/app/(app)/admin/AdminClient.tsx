"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, Dumbbell, Ticket, Shield, Copy, Check, ChevronRight, Plus, Trash2, UserX, RotateCcw } from "lucide-react";
import { cn, formatDate, getInitials, roleLabels, roleBadgeClass } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import { getAccessCodeStatus } from "@/lib/accessCodeStatus";
import { PLAN_TEMPLATES } from "@/lib/templates";

interface AdminUser {
    id: string;
    name?: string | null;
    email: string;
    avatarUrl?: string | null;
    role: string;
    createdAt: string;
    onboardingDone: boolean;
    isDeactivated: boolean;
    isDeleted: boolean;
    coachName?: string | null;
    coachId?: string | null;
}

interface AdminPlan {
    id: string;
    name: string;
    type: string;
    userCount: number;
    users: {
        id: string;
        name?: string | null;
        email: string;
        avatarUrl?: string | null;
        role: string;
        isDeactivated: boolean;
        isDeleted: boolean;
    }[];
}

interface AdminCode {
    id: string;
    code: string;
    planName?: string | null;
    usedBy?: string | null;
    usedByName?: string | null;
    usedByEmail?: string | null;
    usedById?: string | null;
    usedByStatus?: "ACTIVE" | "DEACTIVATED" | "DELETED" | null;
    upgradesTo: string;
    isActive: boolean;
    status?: string | null;
    createdAt: string;
    expiresAt?: string | null;
}

type RawAdminCode = Omit<AdminCode, "usedBy"> & {
    usedBy?: string | { id?: string; name?: string | null; email?: string | null } | null;
};

interface AdminCoach {
    id: string;
    name?: string | null;
    email: string;
    avatarUrl?: string | null;
    role: string;
    activeClientCount: number;
    clients: {
        id: string;
        name?: string | null;
        email: string;
        avatarUrl?: string | null;
        role: string;
        isDeactivated: boolean;
        isDeleted: boolean;
    }[];
}

interface Props {
    users: AdminUser[];
    coaches: AdminCoach[];
    plans: AdminPlan[];
    codes: AdminCode[];
    userRole: string;
}

type Tab = "users" | "coaches" | "plans" | "codes";
type CodeFilter = "ALL" | "ACTIVE" | "USED" | "EXPIRED";

function accountSortRank(account: { isDeleted: boolean; isDeactivated: boolean }) {
    if (account.isDeleted) return 2;
    if (account.isDeactivated) return 1;
    return 0;
}

function sortAdminUsers(users: AdminUser[]) {
    return [...users].sort((a, b) =>
        accountSortRank(a) - accountSortRank(b) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

function normalizeCode(code: RawAdminCode): AdminCode {
    const usedByObject = typeof code.usedBy === "object" && code.usedBy !== null ? code.usedBy : null;
    return {
        ...code,
        usedBy: typeof code.usedBy === "string"
            ? code.usedBy
            : code.usedByName ?? usedByObject?.name ?? usedByObject?.email ?? code.usedByEmail ?? null,
        usedById: code.usedById ?? usedByObject?.id ?? null,
    };
}

function ProfileAvatar({ name, email, avatarUrl }: { name?: string | null; email: string; avatarUrl?: string | null }) {
    const label = name || email;

    return (
        <div className="w-9 h-9 rounded-full overflow-hidden bg-brand-500/10 border border-surface-border flex items-center justify-center shrink-0">
            {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveUploadUrl(avatarUrl)} alt={label} className="w-full h-full object-cover" />
            ) : (
                <span className="text-[11px] font-black text-brand-400 uppercase">
                    {getInitials(label)}
                </span>
            )}
        </div>
    );
}

function codeStatusInput(code: AdminCode) {
    return {
        isActive: code.isActive,
        usedById: code.usedById,
        usedByName: code.usedBy,
        usedByDeleted: code.usedByStatus === "DELETED",
        expiresAt: code.expiresAt,
        status: code.status,
    };
}

export function AdminClient({ users: initialUsers, coaches, plans: initialPlans, codes: initialCodes, userRole }: Props) {
    const [tab, setTab] = useState<Tab>("users");
    const [users, setUsers] = useState<AdminUser[]>(sortAdminUsers(initialUsers));
    const [plansList, setPlansList] = useState<AdminPlan[]>(initialPlans);
    const [codes, setCodes] = useState<AdminCode[]>(initialCodes.map(normalizeCode));
    const [codeFilter, setCodeFilter] = useState<CodeFilter>("ALL");
    const [generatingCode, setGeneratingCode] = useState(false);
    const [deletingCodeId, setDeletingCodeId] = useState<string | null>(null);
    const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
    const [newCode, setNewCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState<string>("");
    const [selectedRole, setSelectedRole] = useState<string>("PREMIUM");
    const [selectedExpiresIn, setSelectedExpiresIn] = useState<string>("0");
    const [promotingId, setPromotingId] = useState<string | null>(null);
    const [confirmingUser, setConfirmingUser] = useState<{ id: string, email: string, role: string } | null>(null);
    const [confirmEmail, setConfirmEmail] = useState("");
    const [selectedCoachId, setSelectedCoachId] = useState<string>("NONE");
    const [accountActionId, setAccountActionId] = useState<string | null>(null);

    const generateCode = async () => {
        setGeneratingCode(true);
        const res = await fetch("/api/codes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                planId: selectedRole === "COACH" || selectedPlanId.startsWith("template:") ? undefined : selectedPlanId || undefined,
                templateId: selectedRole === "COACH" ? undefined : selectedPlanId.startsWith("template:") ? selectedPlanId.replace("template:", "") : undefined,
                upgradesTo: selectedRole,
                expiresInHours: selectedExpiresIn !== "0" ? parseInt(selectedExpiresIn) : undefined
            }),
        });
        if (res.ok) {
            const data = await res.json();
            setNewCode(data.code);
            setSelectedPlanId("");
            // Refresh codes
            const refreshRes = await fetch("/api/codes");
            if (refreshRes.ok) {
                const refreshedCodes = await refreshRes.json() as RawAdminCode[];
                setCodes(refreshedCodes.map(normalizeCode));
            }
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

    const deletePlan = async (plan: AdminPlan) => {
        const activeNote = plan.userCount > 0
            ? `${plan.userCount} user${plan.userCount === 1 ? " has" : "s have"} this as their active plan. `
            : "";
        if (!confirm(`Delete "${plan.name}"?\n\n${activeNote}This permanently removes the plan and cannot be undone.`)) {
            return;
        }

        setDeletingPlanId(plan.id);
        try {
            const res = await fetch(`/api/plans/${plan.id}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                const deletedIds = Array.isArray(data.deletedIds) ? data.deletedIds as string[] : [plan.id];
                setPlansList((current) => current.filter((p) => !deletedIds.includes(p.id)));
                return;
            }
            alert(typeof data.error === "string" ? data.error : "Could not delete plan.");
        } catch {
            alert("Connection error while deleting plan.");
        } finally {
            setDeletingPlanId(null);
        }
    };

    const filteredCodes = codes.filter(c => {
        const status = getAccessCodeStatus(codeStatusInput(c));
        if (codeFilter === "ALL") return true;
        if (codeFilter === "ACTIVE") return status.key === "active";
        if (codeFilter === "USED") return status.key === "redeemed";
        if (codeFilter === "EXPIRED") return status.key === "expired" || status.key === "inactive";
        return true;
    });

    const copyCode = () => {
        if (newCode) {
            navigator.clipboard.writeText(newCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const promoteUser = async (userId: string, role: string, email: string) => {
        if (confirmEmail.toLowerCase() !== email.toLowerCase()) {
            alert("Email mismatch. Evolution denied.");
            return;
        }

        setPromotingId(userId);
        const res = await fetch("/api/admin/users/role", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId,
                role,
                coachId: role === "PREMIUM" && selectedCoachId !== "NONE" ? selectedCoachId : null,
            }),
        });
        
        if (res.ok) {
            const coach = coaches.find(c => c.id === selectedCoachId);
            setUsers(prev => prev.map(u => u.id === userId ? {
                ...u,
                role,
                isDeactivated: false,
                isDeleted: false,
                coachId: role === "PREMIUM" && selectedCoachId !== "NONE" ? selectedCoachId : null,
                coachName: role === "PREMIUM" && selectedCoachId !== "NONE" ? (coach?.name ?? coach?.email ?? null) : null,
            } : u));
            setConfirmingUser(null);
            setConfirmEmail("");
            setSelectedCoachId("NONE");
        } else {
            alert("Failed to update user status.");
        }
        setPromotingId(null);
    };

    const updateAccountStatus = async (user: AdminUser, action: "deactivate" | "reactivate" | "delete") => {
        const actionLabel = action === "delete" ? "delete" : action === "deactivate" ? "deactivate" : "reactivate";
        if (!confirm(`Are you sure you want to ${actionLabel} ${user.email}?`)) return;

        setAccountActionId(user.id);
        const res = await fetch("/api/admin/users/account", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id, action }),
        });

        if (res.ok) {
            if (action === "delete") {
                setUsers(prev => sortAdminUsers(prev.map(u => u.id === user.id ? {
                    ...u,
                    role: "FREE",
                    isDeactivated: true,
                    isDeleted: true,
                    coachId: null,
                    coachName: null,
                } : u)));
            } else {
                setUsers(prev => sortAdminUsers(prev.map(u => u.id === user.id ? { ...u, isDeactivated: action === "deactivate" } : u)));
            }
        } else {
            const data = await res.json().catch(() => null);
            alert(data?.error || "Failed to update account.");
        }
        setAccountActionId(null);
    };

    const activeUsers = users.filter((u) => !u.isDeleted);

    const stats = [
        { label: "Total Users", val: activeUsers.length, icon: Users, color: "text-brand-400" },
        { label: "Premium Users", val: users.filter(u => u.role === "PREMIUM" && !u.isDeactivated && !u.isDeleted).length, icon: Shield, color: "text-success" },
        { label: "Coaches", val: coaches.length, icon: Users, color: "text-warning" },
        { label: "Active Codes", val: codes.filter(c => getAccessCodeStatus(codeStatusInput(c)).key === "active").length, icon: Ticket, color: "text-brand-300" },
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
                    { id: "coaches", label: "Coaches", icon: Shield },
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
                        <p className="text-xs text-fg-muted">{activeUsers.length} total</p>
                    </div>
                    <div className="divide-y divide-surface-border">
                        {users.map((u) => (
                            <div key={u.id} className={cn("flex items-start justify-between gap-4 px-5 py-3.5", (u.isDeactivated || u.isDeleted) && "opacity-60 bg-surface-muted/20")}>
                                <div className="flex items-start gap-3 min-w-0">
                                    <ProfileAvatar name={u.name} email={u.email} avatarUrl={u.avatarUrl} />
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-medium text-sm text-fg truncate">{u.name ?? "No name"}</p>
                                            {(u.isDeleted || u.isDeactivated) && (
                                                <span className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 rounded",
                                                    u.isDeleted ? "text-fg-subtle bg-surface-muted border-surface-border" : "text-danger bg-danger/10 border-danger/20"
                                                )}>
                                                    {u.isDeleted ? "Deleted" : "Deactivated"}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-fg-muted truncate">{u.email}</p>
                                        <p className="text-xs text-fg-subtle">{formatDate(u.createdAt)}</p>
                                        {u.role === "PREMIUM" && (
                                            <p className="text-[10px] text-fg-subtle font-bold uppercase tracking-widest mt-1">
                                                Coach: {u.coachName || "No coach"}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    {!u.isDeleted && (
                                        <>
                                            <div className="flex items-center gap-1.5 p-1 bg-surface-muted rounded-xl border border-surface-border">
                                                {["FREE", "PREMIUM", "COACH", "SUPER_ADMIN"].map((r) => {
                                                    const isActive = u.role === r;
                                                    return (
                                                        <button
                                                            key={r}
                                                            onClick={() => {
                                                                if (!isActive) {
                                                                    setConfirmingUser({ id: u.id, email: u.email, role: r });
                                                                    setSelectedCoachId(r === "PREMIUM" ? (u.coachId || "NONE") : "NONE");
                                                                }
                                                            }}
                                                            className={cn(
                                                                "px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                                                isActive 
                                                                    ? roleBadgeClass[r] + " shadow-sm scale-105 z-10" 
                                                                    : "text-fg-subtle hover:text-fg hover:bg-surface-elevated"
                                                            )}
                                                        >
                                                            {roleLabels[r].replace(" Member", "")}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => updateAccountStatus(u, u.isDeactivated ? "reactivate" : "deactivate")}
                                                    disabled={accountActionId === u.id}
                                                    className="btn-secondary btn-sm text-[10px] font-black uppercase tracking-widest h-8"
                                                >
                                                    {u.isDeactivated ? <RotateCcw className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                                                    {u.isDeactivated ? "Reactivate" : "Deactivate"}
                                                </button>
                                                <button
                                                    onClick={() => updateAccountStatus(u, "delete")}
                                                    disabled={accountActionId === u.id}
                                                    className="btn-secondary btn-sm text-[10px] font-black uppercase tracking-widest h-8 border-danger/30 text-danger hover:bg-danger hover:text-white"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Delete
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {confirmingUser?.id === u.id && (
                                        <div className="mt-3 p-4 bg-surface-card rounded-2xl border-2 border-brand-500/20 shadow-glow-brand-sm space-y-4 animate-slide-up max-w-[300px] relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-brand" />
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">
                                                    Authorization Required
                                                </p>
                                                <p className="text-xs text-fg-muted leading-relaxed">
                                                    You are transitioning <strong>{u.name || "User"}</strong> to <strong>{confirmingUser.role}</strong> status.
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest ml-1">Confirm Recipient Email</label>
                                                <input 
                                                    type="email"
                                                    placeholder={u.email}
                                                    className="input input-sm text-xs font-mono"
                                                    value={confirmEmail}
                                                    onChange={(e) => setConfirmEmail(e.target.value)}
                                                />
                                            </div>

                                            {confirmingUser.role === "PREMIUM" && (
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest ml-1">Coach Assignment</label>
                                                    <select
                                                        className="input input-sm text-xs"
                                                        value={selectedCoachId}
                                                        onChange={(e) => setSelectedCoachId(e.target.value)}
                                                    >
                                                        <option value="NONE">No coach</option>
                                                        {coaches.map((coach) => (
                                                            <option key={coach.id} value={coach.id}>
                                                                {coach.name || coach.email} ({coach.activeClientCount} active)
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            <div className="flex gap-2 pt-2">
                                                <button 
                                                    onClick={() => promoteUser(u.id, confirmingUser.role, u.email)}
                                                    disabled={promotingId === u.id || !confirmEmail}
                                                    className="btn-primary btn-sm flex-1 text-[10px] font-black uppercase tracking-widest h-10 shadow-glow-brand-sm"
                                                >
                                                    {promotingId === u.id ? "Processing..." : "Authorize Change"}
                                                </button>
                                                <button 
                                                    onClick={() => { setConfirmingUser(null); setConfirmEmail(""); setSelectedCoachId("NONE"); }}
                                                    className="btn-secondary btn-sm text-[10px] font-black uppercase tracking-widest h-10 px-4"
                                                >
                                                    Abort
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab: Coaches */}
            {tab === "coaches" && (
                <div className="card overflow-hidden">
                    <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
                        <h3 className="heading-3">Coaches</h3>
                        <p className="text-xs text-fg-muted">{coaches.length} total</p>
                    </div>
                    <div className="divide-y divide-surface-border">
                        {coaches.map((coach) => (
                            <div key={coach.id} className="px-5 py-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <ProfileAvatar name={coach.name} email={coach.email} avatarUrl={coach.avatarUrl} />
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-medium text-sm text-fg truncate">{coach.name ?? "No name"}</p>
                                                {coach.role === "SUPER_ADMIN" && (
                                                    <span className="text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 rounded text-brand-400 bg-brand-500/10 border-brand-500/20">
                                                        Admin
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-fg-muted truncate">{coach.email}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-2xl font-black text-brand-400 leading-none">{coach.activeClientCount}</p>
                                        <p className="text-[10px] text-fg-subtle font-black uppercase tracking-widest mt-1">
                                            Active {coach.activeClientCount === 1 ? "Client" : "Clients"}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 rounded-xl border border-surface-border bg-surface-muted/20 overflow-hidden">
                                    <div className="px-3 py-2 border-b border-surface-border flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Assigned Clients</p>
                                        <span className="text-[10px] font-bold text-fg-muted">{coach.clients.length}</span>
                                    </div>
                                    {coach.clients.length === 0 ? (
                                        <p className="px-3 py-3 text-xs text-fg-muted">No clients assigned.</p>
                                    ) : (
                                        <div className="divide-y divide-surface-border">
                                            {coach.clients.map((client) => (
                                                <div
                                                    key={client.id}
                                                    className={cn(
                                                        "flex items-center justify-between gap-3 px-3 py-2.5",
                                                        (client.isDeleted || client.isDeactivated) && "opacity-60"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <ProfileAvatar name={client.name} email={client.email} avatarUrl={client.avatarUrl} />
                                                        <div className="min-w-0">
                                                            {client.isDeleted ? (
                                                                <p className="text-sm font-medium text-fg truncate">{client.name ?? "No name"}</p>
                                                            ) : (
                                                                <Link href={`/coach/client/${client.id}`} className="text-sm font-medium text-fg truncate hover:text-brand-400">
                                                                    {client.name ?? "No name"}
                                                                </Link>
                                                            )}
                                                            <p className="text-xs text-fg-muted truncate">{client.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 rounded",
                                                            client.isDeleted
                                                                ? "text-fg-subtle bg-surface-muted border-surface-border"
                                                                : client.isDeactivated
                                                                    ? "text-danger bg-danger/10 border-danger/20"
                                                                    : "text-success bg-success/10 border-success/20"
                                                        )}>
                                                            {client.isDeleted ? "Deleted" : client.isDeactivated ? "Deactivated" : "Active"}
                                                        </span>
                                                        <span className={cn("text-[9px] px-2 py-0.5 rounded border font-black uppercase tracking-widest", roleBadgeClass[client.role])}>
                                                            {roleLabels[client.role]?.replace(" Member", "") ?? client.role}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
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
                        {plansList.map((p) => (
                            <div key={p.id} className="px-5 py-4">
                                <div className="flex items-start justify-between gap-4">
                                    <Link href={`/plans/create?id=${p.id}&view=true`} className="min-w-0 group">
                                        <p className="font-medium text-sm text-fg group-hover:text-brand-400 truncate">{p.name}</p>
                                        <p className="text-xs text-fg-muted">{p.type.replace("_", " ")}</p>
                                    </Link>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs text-fg-muted">{p.userCount} active {p.userCount === 1 ? "user" : "users"}</span>
                                        <Link href={`/plans/create?id=${p.id}&view=true`} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-muted">
                                            <ChevronRight className="w-4 h-4 text-fg-subtle" />
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => deletePlan(p)}
                                            disabled={deletingPlanId === p.id}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-danger/10 text-fg-subtle hover:text-danger transition-colors disabled:opacity-50"
                                            title="Delete plan"
                                        >
                                            {deletingPlanId === p.id ? (
                                                <div className="w-4 h-4 border-2 border-danger border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-3 rounded-xl border border-surface-border bg-surface-muted/20 overflow-hidden">
                                    <div className="px-3 py-2 border-b border-surface-border flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Using This As Active Plan</p>
                                        <span className="text-[10px] font-bold text-fg-muted">{p.users.length}</span>
                                    </div>
                                    {p.users.length === 0 ? (
                                        <p className="px-3 py-3 text-xs text-fg-muted">No users have this as their active plan.</p>
                                    ) : (
                                        <div className="divide-y divide-surface-border">
                                            {p.users.map((planUser) => (
                                                <div
                                                    key={planUser.id}
                                                    className={cn(
                                                        "flex items-center justify-between gap-3 px-3 py-2.5",
                                                        (planUser.isDeleted || planUser.isDeactivated) && "opacity-60"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <ProfileAvatar name={planUser.name} email={planUser.email} avatarUrl={planUser.avatarUrl} />
                                                        <div className="min-w-0">
                                                            {planUser.isDeleted ? (
                                                                <p className="text-sm font-medium text-fg truncate">{planUser.name ?? "No name"}</p>
                                                            ) : (
                                                                <Link href={`/coach/client/${planUser.id}`} className="text-sm font-medium text-fg truncate hover:text-brand-400">
                                                                    {planUser.name ?? "No name"}
                                                                </Link>
                                                            )}
                                                            <p className="text-xs text-fg-muted truncate">{planUser.email}</p>
                                                        </div>
                                                    </div>
                                                    <span className={cn(
                                                        "text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 rounded shrink-0",
                                                        planUser.isDeleted
                                                            ? "text-fg-subtle bg-surface-muted border-surface-border"
                                                            : planUser.isDeactivated
                                                                ? "text-danger bg-danger/10 border-danger/20"
                                                                : "text-success bg-success/10 border-success/20"
                                                    )}>
                                                        {planUser.isDeleted ? "Deleted" : planUser.isDeactivated ? "Deactivated" : "Active"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
                                onChange={(e) => {
                                    const nextRole = e.target.value;
                                    setSelectedRole(nextRole);
                                    if (nextRole === "COACH") setSelectedPlanId("");
                                }}
                            >
                                <option value="PREMIUM">Premium Member Code</option>
                                {userRole === "SUPER_ADMIN" && <option value="COACH">Coach Code</option>}
                            </select>
                            <select
                                className={cn("input flex-1", selectedRole === "COACH" && "opacity-50 bg-surface-muted cursor-not-allowed")}
                                value={selectedPlanId}
                                onChange={(e) => setSelectedPlanId(e.target.value)}
                                disabled={selectedRole === "COACH"}
                            >
                                <option value="">No specific plan (Open)</option>
                                <optgroup label="Saved plans">
                                    {plansList.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Templates">
                                    {Object.values(PLAN_TEMPLATES).map((template) => (
                                        <option key={template.id} value={`template:${template.id}`}>{template.name}</option>
                                    ))}
                                </optgroup>
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
                            ) : filteredCodes.map((c) => {
                                const codeStatus = getAccessCodeStatus(codeStatusInput(c));
                                return (
                                <div key={c.id} className="flex items-center justify-between px-5 py-4 group hover:bg-surface-muted/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm",
                                            codeStatus.key === "active"
                                                ? "bg-brand-500/10 border-brand-500/20 text-brand-400"
                                                : codeStatus.key === "redeemed"
                                                    ? "bg-success/10 border-success/20 text-success"
                                                    : codeStatus.key === "expired"
                                                        ? "bg-warning/10 border-warning/20 text-warning"
                                                        : "bg-surface-muted border-surface-border text-fg-subtle"
                                        )}>
                                            <Ticket className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-mono font-black text-sm text-fg tracking-[0.2em]">{c.code}</p>
                                                <span className={cn(
                                                    "text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest",
                                                    c.upgradesTo === "COACH" ? "bg-warning-500/10 text-warning border border-warning/20" : "bg-brand-500/10 text-brand-400 border border-brand/20"
                                                )}>
                                                    {c.upgradesTo === "COACH" ? "Coach" : "Member"}
                                                </span>
                                                {c.usedByStatus && c.usedByStatus !== "ACTIVE" && (
                                                    <span className={cn(
                                                        "text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest border",
                                                        c.usedByStatus === "DELETED"
                                                            ? "bg-surface-muted text-fg-subtle border-surface-border"
                                                            : "bg-danger/10 text-danger border-danger/20"
                                                    )}>
                                                        {c.usedByStatus === "DELETED" ? "Deleted" : "Deactivated"}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest mt-1">
                                                {c.planName ? c.planName : "Open Entry"} · {formatDate(c.createdAt)}
                                                {c.expiresAt && codeStatus.key === "active" && (
                                                    <span className="text-warning ml-2">Exp: {formatDate(c.expiresAt)}</span>
                                                )}
                                            </p>
                                            {c.usedBy && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                                    {c.usedById && c.usedByStatus !== "DELETED" ? (
                                                        <Link 
                                                            href={`/coach/client/${c.usedById}`}
                                                            className={cn(
                                                                "text-[10px] font-black uppercase tracking-widest hover:underline",
                                                                c.usedByStatus === "DEACTIVATED" ? "text-danger" : "text-success"
                                                            )}
                                                        >
                                                            Claimed: {c.usedBy}{c.usedByStatus === "DEACTIVATED" ? " (deactivated)" : ""}
                                                        </Link>
                                                    ) : (
                                                        <p className={cn(
                                                            "text-[10px] font-black uppercase tracking-widest",
                                                            c.usedByStatus === "DELETED" ? "text-fg-subtle" : "text-success"
                                                        )}>
                                                            Claimed: {c.usedBy}{c.usedByStatus === "DELETED" ? " (deleted)" : ""}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right flex flex-col items-end">
                                            <span className={cn(
                                                "text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter border",
                                                codeStatus.badgeClass
                                            )}>
                                                {codeStatus.label}
                                            </span>
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
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

