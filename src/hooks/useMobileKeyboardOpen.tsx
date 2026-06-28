"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** Viewport height shrink above this ≈ software keyboard visible (px). */
const KEYBOARD_THRESHOLD = 80;

const MobileKeyboardContext = createContext(false);

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

function useMobileKeyboardDetection(): boolean {
    const [keyboardOpen, setKeyboardOpen] = useState(false);

    useEffect(() => {
        const mobile = window.matchMedia("(max-width: 767px)");
        if (!mobile.matches) return;

        let blurTimer: ReturnType<typeof setTimeout> | null = null;

        const clearBlurTimer = () => {
            if (blurTimer) clearTimeout(blurTimer);
            blurTimer = null;
        };

        const sync = () => {
            if (!mobile.matches) {
                setKeyboardOpen(false);
                return;
            }
            setKeyboardOpen(isTextInput(document.activeElement) || measureKeyboardOpen());
        };

        const onFocusIn = (e: FocusEvent) => {
            clearBlurTimer();
            if (isTextInput(e.target)) {
                setKeyboardOpen(true);
            }
        };

        const onFocusOut = () => {
            clearBlurTimer();
            blurTimer = setTimeout(sync, 120);
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
            clearBlurTimer();
            vv?.removeEventListener("resize", sync);
            vv?.removeEventListener("scroll", sync);
            document.removeEventListener("focusin", onFocusIn);
            document.removeEventListener("focusout", onFocusOut);
            mobile.removeEventListener("change", onBreakpointChange);
        };
    }, []);

    return keyboardOpen;
}

export function MobileKeyboardProvider({ children }: { children: ReactNode }) {
    const keyboardOpen = useMobileKeyboardDetection();

    useEffect(() => {
        document.documentElement.dataset.mobileKeyboardOpen = keyboardOpen ? "true" : "";
    }, [keyboardOpen]);

    return (
        <MobileKeyboardContext.Provider value={keyboardOpen}>
            {children}
        </MobileKeyboardContext.Provider>
    );
}

/** True while the software keyboard is open on mobile (< md breakpoint). */
export function useMobileKeyboardOpen(): boolean {
    return useContext(MobileKeyboardContext);
}
