"use client";

import { useEffect } from "react";
import { LANDING_LIFTS, landingMediaUrl } from "@/lib/landingMedia";

/** Start fetching landing lift clips as soon as the page mounts — before scroll. */
export function LandingVideoWarmup() {
    useEffect(() => {
        const hrefs = LANDING_LIFTS.map((lift) => landingMediaUrl("videos", lift.video));
        const links: HTMLLinkElement[] = [];

        for (const href of hrefs) {
            if (document.querySelector(`link[rel="preload"][href="${href}"]`)) continue;

            const link = document.createElement("link");
            link.rel = "preload";
            link.as = "video";
            link.href = href;
            document.head.appendChild(link);
            links.push(link);
        }

        return () => {
            for (const link of links) {
                link.remove();
            }
        };
    }, []);

    return null;
}
