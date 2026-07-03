"use client";

import { useEffect, useState } from "react";

const INTRO_DURATION_MS = 3300;
const EXIT_DURATION_MS = 950;

const letters = ["T", "O", "L", "G"];

export function AppIntroSplash() {
    const [mounted, setMounted] = useState(true);
    const [ready, setReady] = useState(false);
    const [leaving, setLeaving] = useState(false);

    useEffect(() => {
        let leaveTimer: number | undefined;
        let removeTimer: number | undefined;
        let firstFrame = 0;
        let secondFrame = 0;

        firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => {
                setReady(true);

                leaveTimer = window.setTimeout(() => {
                    setLeaving(true);
                }, INTRO_DURATION_MS - EXIT_DURATION_MS);
                removeTimer = window.setTimeout(() => {
                    setMounted(false);
                }, INTRO_DURATION_MS);
            });
        });

        return () => {
            window.cancelAnimationFrame(firstFrame);
            window.cancelAnimationFrame(secondFrame);
            if (leaveTimer) window.clearTimeout(leaveTimer);
            if (removeTimer) window.clearTimeout(removeTimer);
        };
    }, []);

    if (!mounted) return null;

    return (
        <div
            className={`app-intro-splash ${ready ? "app-intro-splash--ready" : ""} ${leaving ? "app-intro-splash--leaving" : ""}`}
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
