import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPremiumTrainingRole } from "@/lib/membership";

export function isCoachRole(role: Role | string): boolean {
    return role === "COACH" || role === "SUPER_ADMIN";
}

export function isClientRole(role: Role | string): boolean {
    return role === "FREE" || role === "PREMIUM" || role === "GENERAL_PREMIUM";
}

export { isPremiumTrainingRole, isGeneralPremium, isCoachedPremium, canAccessCheckIns } from "@/lib/membership";

/** Coaches manage clients — they don't share training plans on a public athlete profile. */
export function isEligibleForPublicPlanSharing(role: Role | string): boolean {
    return isClientRole(role);
}

export async function userHasActivePlan(userId: string): Promise<boolean> {
    const active = await prisma.userPlan.findFirst({
        where: { userId, isActive: true },
        select: { id: true },
    });
    return !!active;
}

export async function canPublishPlansToProfile(userId: string, role: Role | string): Promise<boolean> {
    if (!isEligibleForPublicPlanSharing(role)) return false;
    return userHasActivePlan(userId);
}

export function defaultHomeForRole(role: Role | string): "/coach" | "/dashboard" {
    return isCoachRole(role) ? "/coach" : "/dashboard";
}

export function parseTeamCoachId(receiverId: string | null | undefined): string | null {
    if (!receiverId?.startsWith("team_")) return null;
    return receiverId.slice("team_".length) || null;
}

/** Coaches manage client plans only — never keep an active training assignment on their own account. */
export async function deactivateCoachActivePlans(userId: string): Promise<void> {
    await prisma.userPlan.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
    });
}
