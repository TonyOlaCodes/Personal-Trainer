/** Logged-in account shortcuts (sidebar, top bar, dashboard) → Settings */
export const ACCOUNT_SETTINGS_HREF = "/settings";

/** Social contexts (chat, search, other users' profiles) → public profile */
export function getPublicProfileHref(userId: string): string {
    return `/profile/${userId}`;
}

export function getAccountNavHref(): string {
    return ACCOUNT_SETTINGS_HREF;
}

/**
 * Resolve where a profile link should go.
 * - navigation: own user in app shell → Settings; others → public profile
 * - social: always public profile (chat, mentions, profile pages)
 */
export function resolveProfileDestination(
    targetUserId: string,
    viewerUserId: string | null | undefined,
    context: "navigation" | "social"
): string {
    if (context === "navigation" && viewerUserId && targetUserId === viewerUserId) {
        return ACCOUNT_SETTINGS_HREF;
    }
    return getPublicProfileHref(targetUserId);
}

export function isSettingsPath(pathname: string): boolean {
    return pathname === ACCOUNT_SETTINGS_HREF || pathname.startsWith(`${ACCOUNT_SETTINGS_HREF}/`);
}
