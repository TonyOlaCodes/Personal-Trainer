"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { ModalOverlay } from "@/components/shared/ModalOverlay";
import { ACHIEVEMENT_ICON_MAP } from "@/components/shared/AchievementsPanel";
import { cn } from "@/lib/utils";
import { RARITY_TOKENS, type AchievementRarity } from "@/lib/achievements/rarity";
import type { AchievementEventType, AchievementIcon } from "@/lib/achievements/types";

interface PendingEvent {
    id: string;
    familyKey: string;
    name: string;
    description: string;
    rarity: AchievementRarity;
    eventType: AchievementEventType;
    prestigeValue: number | null;
    icon: AchievementIcon;
}

function headlineFor(event: PendingEvent): string {
    if (event.eventType === "upgrade") return "Achievement Upgraded";
    if (event.eventType === "milestone") return "Milestone Reached";
    return "Achievement Unlocked";
}

export function AchievementUnlockHost() {
    const pathname = usePathname();
    const [queue, setQueue] = useState<PendingEvent[]>([]);
    const current = queue[0] ?? null;

    const load = useCallback(async () => {
        if (pathname.startsWith("/plans/log/")) return;
        try {
            const res = await fetch("/api/user/achievements/events");
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data.events) && data.events.length > 0) {
                setQueue(data.events);
            }
        } catch {
            // ignore
        }
    }, [pathname]);

    useEffect(() => {
        void load();
        const onFocus = () => void load();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [load]);

    const dismiss = async () => {
        if (!current) return;
        const id = current.id;
        setQueue((prev) => prev.slice(1));
        try {
            await fetch("/api/user/achievements/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventId: id }),
            });
        } catch {
            // still advance local queue
        }
    };

    if (!current) return null;

    const tokens = RARITY_TOKENS[current.rarity];
    const Icon = ACHIEVEMENT_ICON_MAP[current.icon] ?? ACHIEVEMENT_ICON_MAP.trophy;
    const isLegendary = current.rarity === "legendary";

    return (
        <ModalOverlay open onClose={() => void dismiss()}>
            <div
                className={cn(
                    "relative w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl border-2 bg-surface-card p-6 sm:p-8 text-center animate-slide-up overflow-hidden",
                    tokens.border,
                    tokens.glow,
                    isLegendary && "shadow-[0_0_40px_rgba(251,191,36,0.28)]"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={() => void dismiss()}
                    className="absolute top-4 right-4 btn-icon"
                    aria-label="Close"
                >
                    <X className="w-5 h-5" />
                </button>

                <p className={cn(
                    "text-[10px] font-black uppercase tracking-[0.2em]",
                    tokens.text
                )}>
                    {headlineFor(current)}
                </p>

                <div className={cn(
                    "mx-auto mt-5 w-20 h-20 rounded-3xl border-2 flex items-center justify-center",
                    tokens.badge,
                    tokens.border,
                    isLegendary && "scale-110"
                )}>
                    <Icon className={cn("w-10 h-10", tokens.text)} />
                </div>

                <h3 className="mt-5 text-2xl font-black text-fg tracking-tight">{current.name}</h3>
                <p className={cn("mt-2 text-xs font-black uppercase tracking-widest", tokens.text)}>
                    {tokens.label}
                    {current.prestigeValue != null ? ` · ${current.prestigeValue}` : ""}
                </p>
                <p className="mt-3 text-sm text-fg-muted leading-relaxed">
                    {current.eventType === "milestone" && current.prestigeValue != null
                        ? `Reached ${current.prestigeValue.toLocaleString()} — keep going.`
                        : current.description}
                </p>

                <div className="mt-7 flex flex-col sm:flex-row gap-2">
                    <Link
                        href={`/achievements?focus=${encodeURIComponent(current.familyKey)}`}
                        onClick={() => void dismiss()}
                        className="btn-primary flex-1 justify-center"
                    >
                        View Achievement
                    </Link>
                    <button
                        type="button"
                        onClick={() => void dismiss()}
                        className="btn-secondary flex-1 justify-center"
                    >
                        Continue
                    </button>
                </div>

                {queue.length > 1 && (
                    <p className="mt-4 text-[10px] font-bold text-fg-subtle uppercase tracking-widest">
                        +{queue.length - 1} more waiting
                    </p>
                )}
            </div>
        </ModalOverlay>
    );
}
