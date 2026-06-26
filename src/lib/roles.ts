import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function isCoachRole(role: Role | string): boolean {
    return role === "COACH" || role === "SUPER_ADMIN";
}

export function isClientRole(role: Role | string): boolean {
    return role === "FREE" || role === "PREMIUM";
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
