"use client";

import { useEffect } from "react";

/**
 * While active, blocks page/background scrolling (touch + wheel).
 * Elements marked with `data-allow-scroll="true"` (or nested inside one) may still scroll.
 *
 * Needed on mobile because `overflow: hidden` on body does not stop nested
 * `overflow-y-auto` containers or iOS rubber-band chaining.
 */
export function useIsolateScroll(active: boolean) {
    useEffect(() => {
        if (!active) return;

        const isAllowedScrollTarget = (target: EventTarget | null) => {
            let node = target instanceof Element ? target : null;
            while (node) {
                if (node instanceof HTMLElement && node.dataset.allowScroll === "true") {
                    return true;
                }
                node = node.parentElement;
            }
            return false;
        };

        const blockIfNeeded = (event: Event) => {
            if (isAllowedScrollTarget(event.target)) return;
            event.preventDefault();
        };

        document.addEventListener("touchmove", blockIfNeeded, { passive: false });
        document.addEventListener("wheel", blockIfNeeded, { passive: false });

        return () => {
            document.removeEventListener("touchmove", blockIfNeeded);
            document.removeEventListener("wheel", blockIfNeeded);
        };
    }, [active]);
}
