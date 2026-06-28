"use client";

import { cn } from "@/lib/utils";
import { landingMediaUrl, type LandingMediaCategory } from "@/lib/landingMedia";

export function LandingMediaVideo({
    category,
    filename,
    className,
    overlayClassName,
}: {
    category: LandingMediaCategory;
    filename: string;
    className?: string;
    overlayClassName?: string;
}) {
    const src = landingMediaUrl(category, filename);

    return (
        <div className={cn("relative overflow-hidden bg-black", className)}>
            <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover"
            >
                <source src={src} />
            </video>
            {overlayClassName && (
                <div className={cn("absolute inset-0 pointer-events-none", overlayClassName)} />
            )}
        </div>
    );
}
