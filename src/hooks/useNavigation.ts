"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { appendReturnTo, getReturnToFromSearchParams } from "@/lib/navigation";

export function useCurrentPath(): string {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
}

export function useHrefWithReturn(href: string): string {
    const current = useCurrentPath();
    return appendReturnTo(href, current);
}

export function useReturnTo(fallback = "/dashboard"): string {
    const searchParams = useSearchParams();
    return getReturnToFromSearchParams(searchParams, fallback);
}
