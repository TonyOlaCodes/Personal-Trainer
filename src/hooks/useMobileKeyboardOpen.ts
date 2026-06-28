"use client";

import { useEffect, useState } from "react";

/** Viewport height shrink above this ≈ software keyboard visible (px). */
const KEYBOARD_THRESHOLD = 100;

function isTextInput(el: EventTarget | null): boolean {
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    if (tag === "INPUT") {
        const type = (el as HTMLInputElement).type.toLowerCase();
        return !["checkbox", "radio", "button", "submit", "reset", "file", "hidden", "range", "color", "image"].includes(type);
    }
    return tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function measureKeyboardOpen(): boolean {
    const vv = window.visualViewport;
    if (!vv) return false;
    const gap = window.innerHeight - vv.height - vv.offsetTop;
    return gap > KEYBOARD_THRESHOLD;
}

/** True while the software keyboard is open on mobile (< md breakpoint). */
export function useMobileKeyboardOpen(): boolean {
    const [keyboardOpen, setKeyboardOpen] = useState(false);

    useEffect(() => {
        const mobile = window.matchMedia("(max-width: 767px)");
        if (!mobile.matches) return;

        const sync = () => setKeyboardOpen(measureKeyboardOpen());

        const onFocusIn = (e: FocusEvent) => {
            if (isTextInput(e.target)) {
                setKeyboardOpen(true);
            }
        };

        const onFocusOut = () => {
            requestAnimationFrame(() => {
                const active = document.activeElement;
                if (isTextInput(active)) return;
                sync();
            });
        };

        const vv = window.visualViewport;
        vv?.addEventListener("resize", sync);
        vv?.addEventListener("scroll", sync);
        document.addEventListener("focusin", onFocusIn);
        document.addEventListener("focusout", onFocusOut);

        const onBreakpointChange = (e: MediaQueryListEvent) => {
            if (!e.matches) setKeyboardOpen(false);
        };
        mobile.addEventListener("change", onBreakpointChange);

        return () => {
            vv?.removeEventListener("resize", sync);
            vv?.removeEventListener("scroll", sync);
            document.removeEventListener("focusin", onFocusIn);
            document.removeEventListener("focusout", onFocusOut);
            mobile.removeEventListener("change", onBreakpointChange);
        };
    }, []);

    return keyboardOpen;
}
