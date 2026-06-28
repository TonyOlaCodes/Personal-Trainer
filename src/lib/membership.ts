import type { Role } from "@prisma/client";

/** Full premium training experience (with or without a coach). */
export function isPremiumTrainingRole(role: Role | string): boolean {
    return role === "PREMIUM" || role === "GENERAL_PREMIUM" || role === "COACH" || role === "SUPER_ADMIN";
}

export function isGeneralPremium(role: Role | string): boolean {
    return role === "GENERAL_PREMIUM";
}

/** Coached athlete — premium with an assigned coach. */
export function isCoachedPremium(role: Role | string, coachId?: string | null): boolean {
    return role === "PREMIUM" && Boolean(coachId);
}

/** Weekly check-ins and coach feedback flows. */
export function canAccessCheckIns(role: Role | string, coachId?: string | null): boolean {
    if (role === "COACH" || role === "SUPER_ADMIN") return true;
    return isCoachedPremium(role, coachId);
}

export function membershipLabel(role: Role | string): string {
    if (role === "GENERAL_PREMIUM") return "General Premium";
    if (role === "PREMIUM") return "Coached Premium";
    return role;
}
