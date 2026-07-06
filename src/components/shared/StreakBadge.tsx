"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakBadgeProps {
    streak: number;
    size?: "sm" | "md" | "lg";
    className?: string;
}

const sizeStyles = {
    sm: {
        wrap: "gap-1",
        icon: "w-3.5 h-3.5",
        value: "text-xs",
    },
    md: {
        wrap: "gap-1",
        icon: "w-4 h-4",
        value: "text-sm",
    },
    lg: {
        wrap: "gap-1.5",
        icon: "w-5 h-5",
        value: "text-base",
    },
} as const;

export function StreakBadge({
    streak,
    size = "md",
    className,
}: StreakBadgeProps) {
    if (streak <= 0) return null;

    const s = sizeStyles[size];

    return (
        <div
            title={`${streak} day${streak === 1 ? "" : "s"} on plan in a row`}
            className={cn(
                "inline-flex items-center cursor-default select-none",
                s.wrap,
                className
            )}
        >
            <Flame
                className={cn(
                    s.icon,
                    "fill-orange-500 text-red-500 shrink-0"
                )}
            />
            <span
                className={cn(
                    s.value,
                    "font-black tabular-nums leading-none text-orange-500"
                )}
            >
                {streak}
            </span>
        </div>
    );
}
