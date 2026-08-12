"use client";

import { useEffect, useState } from "react";

export interface VisualViewportMetrics {
    /** Visible height in CSS pixels (excludes software keyboard). */
    height: number;
    /** Offset of the visual viewport from the top of the layout viewport. */
    offsetTop: number;
}

/**
 * Live visualViewport size/offset so sheets can sit in the area above the keyboard
 * instead of being covered by it (or requiring a manual scroll).
 */
export function useVisualViewport(): VisualViewportMetrics | null {
    const [metrics, setMetrics] = useState<VisualViewportMetrics | null>(null);

    useEffect(() => {
        const measure = () => {
            const vv = window.visualViewport;
            setMetrics({
                height: vv ? vv.height : window.innerHeight,
                offsetTop: vv ? vv.offsetTop : 0,
            });
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

    return metrics;
}

/** @deprecated Prefer `useVisualViewport().height` — kept for existing call sites. */
export function useVisualViewportHeight(): number | null {
    return useVisualViewport()?.height ?? null;
}
