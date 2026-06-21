export type CoachPlanRecord = {
    id: string;
    name: string;
    type?: string;
    updatedAt?: Date | string;
    creatorId?: string | null;
};

function planDedupeKey(plan: Pick<CoachPlanRecord, "name" | "creatorId">) {
    const nameKey = plan.name.trim().toLowerCase();
    return plan.creatorId ? `${plan.creatorId}:${nameKey}` : nameKey;
}

/** Keep the most recently updated plan for each programme name (per creator when available). */
export function dedupeCoachPlansByName<T extends CoachPlanRecord>(plans: T[]): T[] {
    const byKey = new Map<string, T>();

    for (const plan of plans) {
        const key = planDedupeKey(plan);
        const existing = byKey.get(key);
        if (!existing) {
            byKey.set(key, plan);
            continue;
        }
        const existingTs = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const planTs = plan.updatedAt ? new Date(plan.updatedAt).getTime() : 0;
        if (planTs >= existingTs) {
            byKey.set(key, plan);
        }
    }

    return [...byKey.values()].sort(
        (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
    );
}

export type AdminPlanUser = {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
    role: string;
    isDeactivated: boolean;
    isDeleted: boolean;
};

export type AdminPlanSummary = CoachPlanRecord & {
    type: string;
    userCount: number;
    users: AdminPlanUser[];
};

function mergeAdminPlanUsers(userGroups: AdminPlanUser[][]) {
    const byId = new Map<string, AdminPlanUser>();
    for (const users of userGroups) {
        for (const user of users) {
            if (!byId.has(user.id)) byId.set(user.id, user);
        }
    }
    return [...byId.values()].sort((a, b) => {
        const rank = (user: AdminPlanUser) => (user.isDeleted ? 2 : user.isDeactivated ? 1 : 0);
        const rankDiff = rank(a) - rank(b);
        if (rankDiff !== 0) return rankDiff;
        return (a.name ?? a.email).localeCompare(b.name ?? b.email);
    });
}

/** Dedupe admin plan rows by creator + name, keeping the latest version and merged active users. */
export function dedupeAdminPlansByName(plans: AdminPlanSummary[]): AdminPlanSummary[] {
    const byKey = new Map<string, AdminPlanSummary>();

    for (const plan of plans) {
        const key = planDedupeKey(plan);
        const existing = byKey.get(key);
        if (!existing) {
            byKey.set(key, { ...plan, users: [...plan.users] });
            continue;
        }

        const mergedUsers = mergeAdminPlanUsers([existing.users, plan.users]);
        const mergedCount = mergedUsers.filter((user) => !user.isDeactivated && !user.isDeleted).length;
        const latest = new Date(plan.updatedAt ?? 0).getTime() >= new Date(existing.updatedAt ?? 0).getTime() ? plan : existing;

        byKey.set(key, {
            ...latest,
            users: mergedUsers,
            userCount: mergedCount,
        });
    }

    return [...byKey.values()].sort(
        (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
    );
}

/** Map an assigned/invite plan id to the deduped picker option (latest version by name). */
export function normalizePlanIdForPicker(
    planId: string | null | undefined,
    allPlans: CoachPlanRecord[],
    pickerPlans?: CoachPlanRecord[]
): string {
    if (!planId) return "";

    const options = pickerPlans ?? dedupeCoachPlansByName(allPlans);
    if (options.some((plan) => plan.id === planId)) return planId;

    const assigned = allPlans.find((plan) => plan.id === planId);
    if (!assigned) return "";

    const latest = options.find(
        (plan) => planDedupeKey(plan) === planDedupeKey(assigned)
    );
    return latest?.id ?? "";
}

export function formatCoachPlanLabel(plan: Pick<CoachPlanRecord, "name" | "type">): string {
    const typeLabel = plan.type ? ` · ${plan.type.replace(/_/g, " ")}` : "";
    return `${plan.name}${typeLabel}`;
}
