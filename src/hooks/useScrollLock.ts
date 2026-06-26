"use client";

import { useEffect } from "react";

let lockCount = 0;
let savedScrollY = 0;

function lockBodyScroll() {
    lockCount += 1;
    if (lockCount > 1) return;

    savedScrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const { style } = document.body;

    document.documentElement.style.overflow = "hidden";
    style.overflow = "hidden";
    style.position = "fixed";
    style.top = `-${savedScrollY}px`;
    style.left = "0";
    style.right = "0";
    style.width = "100%";
    if (scrollbarWidth > 0) {
        style.paddingRight = `${scrollbarWidth}px`;
    }
}

function unlockBodyScroll() {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount > 0) return;

    const { style } = document.body;
    document.documentElement.style.overflow = "";
    style.overflow = "";
    style.position = "";
    style.top = "";
    style.left = "";
    style.right = "";
    style.width = "";
    style.paddingRight = "";
    window.scrollTo(0, savedScrollY);
}

/** Locks document scroll while `active` is true. Supports nested modals via ref counting. */
export function useScrollLock(active: boolean) {
    useEffect(() => {
        if (!active) return;
        lockBodyScroll();
        return () => unlockBodyScroll();
    }, [active]);
}
