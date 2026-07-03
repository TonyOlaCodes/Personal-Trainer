"use client";

import { useEffect, useState } from "react";

const FULL_DURATION_MS = 2600;
const REDUCED_DURATION_MS = 700;
const EXIT_DURATION_MS = 420;

const letters = ["T", "O", "L", "G"];

export function AppIntroSplash() {
    const [mounted, setMounted] = useState(true);
    const [leaving, setLeaving] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const duration = prefersReducedMotion ? REDUCED_DURATION_MS : FULL_DURATION_MS;
        const root = document.documentElement;

        setReducedMotion(prefersReducedMotion);
        root.classList.add("app-intro-active");

        const leaveTimer = window.setTimeout(() => {
            root.classList.add("app-intro-revealing");
            setLeaving(true);
        }, Math.max(0, duration - EXIT_DURATION_MS));
        const removeTimer = window.setTimeout(() => {
            root.classList.remove("app-intro-active", "app-intro-revealing");
            setMounted(false);
        }, duration);

        return () => {
            window.clearTimeout(leaveTimer);
            window.clearTimeout(removeTimer);
            root.classList.remove("app-intro-active", "app-intro-revealing");
        };
    }, []);

    if (!mounted) return null;

    return (
        <div
            className={`app-intro-splash ${leaving ? "app-intro-splash--leaving" : ""} ${reducedMotion ? "app-intro-splash--reduced" : ""}`}
            role="status"
            aria-label="Loading TOLGcoaching"
        >
            <div className="app-intro-splash__mark" aria-hidden="true">
                {letters.map((letter, index) => (
                    <span
                        key={letter}
                        className="app-intro-splash__letter"
                        style={{ ["--intro-index" as string]: index }}
                    >
                        {letter}
                    </span>
                ))}
            </div>
            <div className="app-intro-splash__line" aria-hidden="true" />
            <p className="app-intro-splash__tagline">Train &middot; Optimise &middot; Learn &middot; Grow</p>
        </div>
    );
}
