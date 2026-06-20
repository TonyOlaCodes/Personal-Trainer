export type CoachPlanRecord = {
    id: string;
    name: string;
    type?: string;
    updatedAt: Date | string;
};

/** Keep the most recently updated plan for each programme name. */
export function dedupeCoachPlansByName<T extends CoachPlanRecord>(plans: T[]): T[] {
    const byName = new Map<string, T>();

    for (const plan of plans) {
        const key = plan.name.trim().toLowerCase();
        const existing = byName.get(key);
        if (!existing) {
            byName.set(key, plan);
            continue;
        }
        const existingTs = new Date(existing.updatedAt).getTime();
        const planTs = new Date(plan.updatedAt).getTime();
        if (planTs >= existingTs) {
            byName.set(key, plan);
        }
    }

    return [...byName.values()].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
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
        (plan) => plan.name.trim().toLowerCase() === assigned.name.trim().toLowerCase()
    );
    return latest?.id ?? "";
}

export function formatCoachPlanLabel(plan: Pick<CoachPlanRecord, "name" | "type">): string {
    const typeLabel = plan.type ? ` · ${plan.type.replace(/_/g, " ")}` : "";
    return `${plan.name}${typeLabel}`;
}
