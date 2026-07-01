"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { landingMediaUrl, type LandingMediaCategory } from "@/lib/landingMedia";

export function LandingMediaVideo({
    category,
    filename,
    className,
    overlayClassName,
    priority = false,
}: {
    category: LandingMediaCategory;
    filename: string;
    className?: string;
    overlayClassName?: string;
    /** Hint the browser to fetch this clip before others on the page. */
    priority?: boolean;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const src = landingMediaUrl(category, filename);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const tryPlay = () => {
            if (video.paused) {
                void video.play().catch(() => {});
            }
        };

        video.addEventListener("loadeddata", tryPlay);
        video.addEventListener("canplay", tryPlay);
        video.addEventListener("canplaythrough", tryPlay);

        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            tryPlay();
        } else {
            video.load();
        }

        return () => {
            video.removeEventListener("loadeddata", tryPlay);
            video.removeEventListener("canplay", tryPlay);
            video.removeEventListener("canplaythrough", tryPlay);
        };
    }, [src]);

    return (
        <div className={cn("relative overflow-hidden bg-black", className)}>
            <video
                ref={videoRef}
                src={src}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                {...(priority ? { fetchPriority: "high" as const } : {})}
                disablePictureInPicture
                className="absolute inset-0 h-full w-full object-cover"
            />
            {overlayClassName && (
                <div className={cn("absolute inset-0 pointer-events-none", overlayClassName)} />
            )}
        </div>
    );
}
