"use client";

import { useEffect, useState } from "react";

/**
 * The height of the area actually visible to the user, in pixels.
 *
 * On mobile the software keyboard overlays the layout viewport without changing
 * `100dvh`, so a sheet sized in viewport units ends up partly underneath the keyboard.
 * Sizing against `visualViewport.height` instead keeps a search field and its results on
 * screen while the keyboard is open, with no manual scrolling.
 *
 * Returns null until measured so server render and first paint agree.
 */
export function useVisualViewportHeight(): number | null {
    const [height, setHeight] = useState<number | null>(null);

    useEffect(() => {
        const measure = () => {
            const vv = window.visualViewport;
            setHeight(vv ? vv.height : window.innerHeight);
        };

        measure();

        const vv = window.visualViewport;
        vv?.addEventListener("resize", measure);
        vv?.addEventListener("scroll", measure);
        window.addEventListener("resize", measure);
        window.addEventListener("orientationchange", measure);

        return () => {
            vv?.removeEventListener("resize", measure);
            vv?.removeEventListener("scroll", measure);
            window.removeEventListener("resize", measure);
            window.removeEventListener("orientationchange", measure);
        };
    }, []);

    return height;
}
