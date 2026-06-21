export type AccessCodeLike = {
    isActive: boolean;
    usedById?: string | null;
    usedByName?: string | null;
    usedByDeleted?: boolean;
    expiresAt?: string | Date | null;
    status?: string | null;
};

export type AccessCodeStatusKey = "active" | "redeemed" | "expired" | "inactive";

export function getAccessCodeStatus(code: AccessCodeLike): {
    key: AccessCodeStatusKey;
    label: string;
    badgeClass: string;
} {
    const redeemed = Boolean(code.usedById || code.usedByName);
    const expiresAt = code.expiresAt ? new Date(code.expiresAt) : null;
    const expiredByDate = expiresAt != null && expiresAt.getTime() < Date.now();
    const storedStatus = code.status?.toLowerCase();

    if (redeemed && code.usedByDeleted) {
        return {
            key: "expired",
            label: "Expired",
            badgeClass: "bg-warning/10 text-warning border-warning/20",
        };
    }

    if (redeemed) {
        return {
            key: "redeemed",
            label: "Redeemed",
            badgeClass: "bg-success/10 text-success border-success/20",
        };
    }

    if (expiredByDate || storedStatus === "expired") {
        return {
            key: "expired",
            label: "Expired",
            badgeClass: "bg-warning/10 text-warning border-warning/20",
        };
    }

    if (storedStatus === "deleted") {
        return {
            key: "inactive",
            label: "Deleted",
            badgeClass: "bg-surface-muted text-fg-subtle border-surface-border",
        };
    }

    if (code.isActive) {
        return {
            key: "active",
            label: "Active",
            badgeClass: "bg-brand-500/10 text-brand-400 border-brand-500/20",
        };
    }

    return {
        key: "inactive",
        label: "Inactive",
        badgeClass: "bg-surface-muted text-fg-subtle border-surface-border",
    };
}
