"use client";

import { useEffect, useMemo, useState } from "react";
import { Megaphone, Pencil, Plus, Trash2, X } from "lucide-react";
import { ModalOverlay } from "@/components/shared/ModalOverlay";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import {
    ANNOUNCEMENT_AUDIENCES,
    AUDIENCE_LABELS,
    type AnnouncementAudience,
} from "@/lib/announcements";

interface AdminUserOption {
    id: string;
    name?: string | null;
    email: string;
    role: string;
    isDeleted?: boolean;
    isDeactivated?: boolean;
}

interface AnnouncementItem {
    id: string;
    title: string;
    body: string;
    targetAudience: AnnouncementAudience;
    targetUserIds: string[];
    scheduledAt: string | null;
    expiresAt: string | null;
    dashboardBannerDays: number;
    adminName: string;
    notificationsSentAt: string | null;
    createdAt: string;
    updatedAt: string;
}

interface Props {
    users: AdminUserOption[];
}

type FormState = {
    title: string;
    body: string;
    targetAudience: AnnouncementAudience;
    targetUserIds: string[];
    scheduledAt: string;
    expiresAt: string;
    dashboardBannerDays: number;
};

const EMPTY_FORM: FormState = {
    title: "",
    body: "",
    targetAudience: "EVERYONE",
    targetUserIds: [],
    scheduledAt: "",
    expiresAt: "",
    dashboardBannerDays: 7,
};

function toLocalInputValue(iso: string | null) {
    if (!iso) return "";
    const date = new Date(iso);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60_000);
    return local.toISOString().slice(0, 16);
}

function announcementStatus(item: AnnouncementItem) {
    const now = Date.now();
    if (item.scheduledAt && new Date(item.scheduledAt).getTime() > now) {
        return { label: "Scheduled", className: "text-warning bg-warning/10 border-warning/20" };
    }
    if (item.expiresAt && new Date(item.expiresAt).getTime() <= now) {
        return { label: "Expired", className: "text-fg-subtle bg-surface-muted border-surface-border" };
    }
    return { label: "Active", className: "text-success bg-success/10 border-success/20" };
}

export function AdminAnnouncementsPanel({ users }: Props) {
    const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const selectableUsers = useMemo(
        () => users.filter((user) => !user.isDeleted && !user.isDeactivated),
        [users]
    );

    const loadAnnouncements = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/announcements");
            if (res.ok) {
                setAnnouncements(await res.json());
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAnnouncements();
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setError(null);
        setModalOpen(true);
    };

    const openEdit = (item: AnnouncementItem) => {
        setEditingId(item.id);
        setForm({
            title: item.title,
            body: item.body,
            targetAudience: item.targetAudience,
            targetUserIds: item.targetUserIds,
            scheduledAt: toLocalInputValue(item.scheduledAt),
            expiresAt: toLocalInputValue(item.expiresAt),
            dashboardBannerDays: item.dashboardBannerDays,
        });
        setError(null);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        setError(null);
    };

    const toggleUser = (userId: string) => {
        setForm((prev) => ({
            ...prev,
            targetUserIds: prev.targetUserIds.includes(userId)
                ? prev.targetUserIds.filter((id) => id !== userId)
                : [...prev.targetUserIds, userId],
        }));
    };

    const saveAnnouncement = async () => {
        if (!form.title.trim() || !form.body.trim()) {
            setError("Title and message are required");
            return;
        }
        if (form.targetAudience === "SELECTED" && form.targetUserIds.length === 0) {
            setError("Select at least one user");
            return;
        }

        setSubmitting(true);
        setError(null);

        const payload = {
            title: form.title.trim(),
            body: form.body.trim(),
            targetAudience: form.targetAudience,
            targetUserIds: form.targetAudience === "SELECTED" ? form.targetUserIds : [],
            scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
            expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
            dashboardBannerDays: form.dashboardBannerDays,
        };

        try {
            const res = await fetch("/api/admin/announcements", {
                method: editingId ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(typeof data.error === "string" ? data.error : "Failed to save announcement");
                return;
            }
            closeModal();
            await loadAnnouncements();
        } finally {
            setSubmitting(false);
        }
    };

    const deleteAnnouncement = async (id: string) => {
        if (!confirm("Delete this announcement? Users will no longer see it.")) return;
        setDeletingId(id);
        try {
            const res = await fetch("/api/admin/announcements", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (res.ok) {
                setAnnouncements((prev) => prev.filter((item) => item.id !== id));
            }
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between gap-3">
                    <div>
                        <h3 className="heading-3">Global Announcements</h3>
                        <p className="text-xs text-fg-muted mt-0.5">
                            Broadcast pop-up messages to targeted user groups
                        </p>
                    </div>
                    <button type="button" onClick={openCreate} className="btn-primary text-xs px-3 py-2">
                        <Plus className="w-3.5 h-3.5" />
                        New
                    </button>
                </div>

                <div className="divide-y divide-surface-border">
                    {loading ? (
                        <div className="p-8 text-center text-sm text-fg-muted">Loading announcements...</div>
                    ) : announcements.length === 0 ? (
                        <div className="p-10 text-center">
                            <Megaphone className="w-10 h-10 mx-auto mb-3 text-brand-400/40" />
                            <p className="text-sm font-bold text-fg">No announcements yet</p>
                            <p className="text-xs text-fg-muted mt-1">Create one to notify users when they open the app.</p>
                        </div>
                    ) : (
                        announcements.map((item) => {
                            const status = announcementStatus(item);
                            return (
                                <div key={item.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <h4 className="font-black text-sm text-fg">{item.title}</h4>
                                            <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border", status.className)}>
                                                {status.label}
                                            </span>
                                        </div>
                                        <p className="text-sm text-fg-muted line-clamp-2">{item.body}</p>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
                                            <span>{AUDIENCE_LABELS[item.targetAudience]}</span>
                                            <span>By {item.adminName}</span>
                                            <span>{formatRelative(item.createdAt)}</span>
                                            {item.scheduledAt && <span>Starts {formatDate(item.scheduledAt)}</span>}
                                            {item.expiresAt && <span>Ends {formatDate(item.expiresAt)}</span>}
                                            <span>Dashboard {item.dashboardBannerDays}d after dismiss</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button type="button" onClick={() => openEdit(item)} className="btn-icon" title="Edit">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteAnnouncement(item.id)}
                                            disabled={deletingId === item.id}
                                            className="btn-icon text-danger hover:bg-danger/10"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {modalOpen && (
                <ModalOverlay onClose={closeModal}>
                    <div
                        className="bg-surface-card w-full sm:max-w-2xl max-h-[90vh] rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between gap-4 shrink-0">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Admin</p>
                                <h3 className="text-lg font-black text-fg">
                                    {editingId ? "Edit Announcement" : "New Announcement"}
                                </h3>
                            </div>
                            <button type="button" onClick={closeModal} className="btn-icon">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4 min-h-0">
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">Title</label>
                                <input
                                    className="input w-full mt-1.5"
                                    value={form.title}
                                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                                    maxLength={200}
                                    placeholder="Maintenance tonight at 10pm"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">Message</label>
                                <textarea
                                    className="input w-full mt-1.5 min-h-[120px] resize-y"
                                    value={form.body}
                                    onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                                    maxLength={5000}
                                    placeholder="Write the announcement users will see..."
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">Audience</label>
                                <select
                                    className="input w-full mt-1.5"
                                    value={form.targetAudience}
                                    onChange={(e) => setForm((prev) => ({
                                        ...prev,
                                        targetAudience: e.target.value as AnnouncementAudience,
                                    }))}
                                >
                                    {ANNOUNCEMENT_AUDIENCES.map((audience) => (
                                        <option key={audience} value={audience}>
                                            {AUDIENCE_LABELS[audience]}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {form.targetAudience === "SELECTED" && (
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
                                        Selected users ({form.targetUserIds.length})
                                    </label>
                                    <div className="mt-1.5 max-h-44 overflow-y-auto rounded-xl border border-surface-border divide-y divide-surface-border">
                                        {selectableUsers.map((user) => (
                                            <label
                                                key={user.id}
                                                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-muted/40"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={form.targetUserIds.includes(user.id)}
                                                    onChange={() => toggleUser(user.id)}
                                                />
                                                <span className="text-sm font-medium text-fg truncate">
                                                    {user.name || user.email}
                                                </span>
                                                <span className="text-[10px] text-fg-subtle uppercase tracking-wider ml-auto">
                                                    {user.role}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">Schedule start (optional)</label>
                                    <input
                                        type="datetime-local"
                                        className="input w-full mt-1.5"
                                        value={form.scheduledAt}
                                        onChange={(e) => setForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">Expires (optional)</label>
                                    <input
                                        type="datetime-local"
                                        className="input w-full mt-1.5"
                                        value={form.expiresAt}
                                        onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-fg-subtle">
                                    Dashboard banner duration after dismiss (days)
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={90}
                                    className="input w-full mt-1.5"
                                    value={form.dashboardBannerDays}
                                    onChange={(e) => setForm((prev) => ({
                                        ...prev,
                                        dashboardBannerDays: Math.max(1, Math.min(90, Number(e.target.value) || 7)),
                                    }))}
                                />
                            </div>

                            {error && <p className="text-xs font-medium text-danger">{error}</p>}
                        </div>

                        <div className="px-5 py-4 border-t border-surface-border flex gap-2 shrink-0">
                            <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
                            <button
                                type="button"
                                onClick={saveAnnouncement}
                                disabled={submitting}
                                className="btn-primary flex-1"
                            >
                                {submitting ? "Saving..." : editingId ? "Save changes" : "Publish"}
                            </button>
                        </div>
                    </div>
                </ModalOverlay>
            )}
        </>
    );
}
