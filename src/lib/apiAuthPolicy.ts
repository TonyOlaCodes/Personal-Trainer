/**
 * Pure authorization decisions used by API helpers and reliability tests.
 * Route handlers still load users from the session; they must not trust body userIds.
 */

export type AuthFailure = { ok: false; status: 401 | 403 | 404; error: string };
export type AuthSuccess = { ok: true };

export function resolveActiveUserGate(input: {
    hasClerkSession: boolean;
    user: { email: string; isDeactivated?: boolean; isDeleted?: boolean } | null;
}): AuthFailure | AuthSuccess {
    if (!input.hasClerkSession) {
        return { ok: false, status: 401, error: "Unauthorized" };
    }
    if (!input.user) {
        return { ok: false, status: 404, error: "User not found" };
    }
    if (input.user.isDeleted || input.user.isDeactivated || input.user.email.endsWith("@deleted.local")) {
        return { ok: false, status: 403, error: "Account deactivated" };
    }
    return { ok: true };
}

export function canAccessAdminApi(role: string): boolean {
    return role === "SUPER_ADMIN";
}

export function isAuthorizedCoachForClient(
    actor: { id: string; role: string },
    clientCoachId: string | null
): boolean {
    if (actor.role === "SUPER_ADMIN") return true;
    if (actor.role !== "COACH") return false;
    return clientCoachId === actor.id;
}
