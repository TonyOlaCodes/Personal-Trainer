export const RETURN_PARAM = "from";

/** Only allow same-origin relative app paths. */
export function sanitizeReturnPath(value: string | null | undefined, fallback = "/dashboard"): string {
    if (!value) return fallback;
    let decoded = value;
    try {
        decoded = decodeURIComponent(value);
    } catch {
        return fallback;
    }
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;
    return decoded;
}

export function appendReturnTo(path: string, returnTo: string): string {
    const [pathAndQuery, hash = ""] = path.split("#");
    const [pathname, query = ""] = pathAndQuery.split("?");
    const params = new URLSearchParams(query);
    params.set(RETURN_PARAM, returnTo);
    const qs = params.toString();
    return `${pathname}?${qs}${hash ? `#${hash}` : ""}`;
}

export function getReturnToFromSearchParams(
    searchParams: { get(key: string): string | null },
    fallback = "/dashboard"
): string {
    return sanitizeReturnPath(searchParams.get(RETURN_PARAM), fallback);
}
