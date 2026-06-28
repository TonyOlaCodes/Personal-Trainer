export interface NavMatchItem {
    href: string;
    exact?: boolean;
}

/** True when pathname is this nav href or a nested route under it. */
export function isNavPathActive(pathname: string, href: string, exact = false): boolean {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
}

/** Pick the most specific nav href that matches (only one active section). */
export function getActiveNavHref(pathname: string, items: NavMatchItem[]): string | null {
    const matches = items.filter((item) => isNavPathActive(pathname, item.href, item.exact));
    if (matches.length === 0) return null;
    return matches.reduce((best, item) => (item.href.length > best.href.length ? item : best)).href;
}
