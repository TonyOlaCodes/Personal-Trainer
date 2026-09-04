"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe media query subscription.
 *
 * Returns `false` on the server and during the first client render, so callers
 * should treat it as "not yet known" rather than "definitely mobile".
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia(query);
        const update = () => setMatches(mq.matches);
        update();
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    }, [query]);

    return matches;
}

/**
 * `xl` breakpoint — where there is genuinely room for an editor and a side panel.
 * Below this a split would squeeze the editor's input rows, so those screens get a
 * full-screen modal instead.
 */
export function useIsSplitViewWidth(): boolean {
    return useMediaQuery("(min-width: 1280px)");
}
