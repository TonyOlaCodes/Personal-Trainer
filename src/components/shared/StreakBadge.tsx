"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakBadgeProps {
    streak: number;
    size?: "sm" | "md" | "lg";
    showLabel?: boolean;
    className?: string;
}

const sizeStyles = {
    sm: {
        wrap: "px-2.5 py-1 gap-1",
        icon: "w-3.5 h-3.5",
        value: "text-xs",
        label: "text-[9px]",
    },
    md: {
        wrap: "px-3 py-1.5 gap-1.5",
        icon: "w-4 h-4",
        value: "text-sm",
        label: "text-[10px]",
    },
    lg: {
        wrap: "px-4 py-2 gap-2",
        icon: "w-5 h-5",
        value: "text-lg",
        label: "text-[10px]",
    },
} as const;

export function StreakBadge({
    streak,
    size = "md",
    showLabel = false,
    className,
}: StreakBadgeProps) {
    if (streak <= 0) return null;

    const s = sizeStyles[size];

    return (
        <div
            title={`${streak} day training streak`}
            className={cn(
                "inline-flex items-center rounded-full border cursor-default select-none",
                "bg-gradient-to-r from-red-600/20 via-orange-500/20 to-amber-500/15",
                "border-orange-500/40 text-orange-300",
                "shadow-[0_0_12px_rgba(249,115,22,0.35),0_0_24px_rgba(239,68,68,0.15)]",
                "streak-fire-glow",
                s.wrap,
                className
            )}
        >
            <Flame
                className={cn(
                    s.icon,
                    "fill-orange-500 text-red-500 streak-flame-icon shrink-0"
                )}
            />
            <span className={cn(s.value, "font-black tabular-nums leading-none text-orange-200")}>
                {streak}
            </span>
            {showLabel && (
                <span className={cn(s.label, "font-black uppercase tracking-widest text-orange-400/90")}>
                    day{streak === 1 ? "" : "s"}
                </span>
            )}
        </div>
    );
}
