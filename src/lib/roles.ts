import type { Role } from "@prisma/client";

export function isClientViewMode(req: Request): boolean {
    const cookie = req.headers.get("cookie") ?? "";
    return /(?:^|;\s*)viewMode=CLIENT(?:;|$)/.test(cookie);
}

export function defaultHomeForRole(role: Role | string): "/coach" | "/dashboard" {
    return role === "COACH" || role === "SUPER_ADMIN" ? "/coach" : "/dashboard";
}

export function parseTeamCoachId(receiverId: string | null | undefined): string | null {
    if (!receiverId?.startsWith("team_")) return null;
    return receiverId.slice("team_".length) || null;
}
