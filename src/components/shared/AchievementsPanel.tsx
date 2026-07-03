"use client";

import { useState } from "react";
import {
    Calendar, ClipboardList, Clock, Copy, Dumbbell, Flame, FolderOpen,
    MessageSquare, Scale, Share2, Star, Target, TrendingUp, Trophy, Users, Zap, Check, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    RARITY_STYLES,
    type AchievementIcon,
    type AchievementRarity,
} from "@/lib/achievementDefinitions";
import type { AchievementDisplayItem } from "@/lib/achievements";

const ICON_MAP: Record<AchievementIcon, React.ComponentType<{ className?: string }>> = {
    dumbbell: Dumbbell,
    trophy: Trophy,
    flame: Flame,
    clipboard: ClipboardList,
    scale: Scale,
    trending: TrendingUp,
    folder: FolderOpen,
    share: Share2,
    copy: Copy,
    message: MessageSquare,
    users: Users,
    calendar: Calendar,
    clock: Clock,
    star: Star,
    target: Target,
    zap: Zap,
};

function formatProgress(current: number, target: number): string {
    if (target >= 1000) {
        return `${current.toLocaleString()}/${target.toLocaleString()}`;
    }
    return `${current}/${target}`;
}

const UNLOCKED_TILE_STYLES: Record<AchievementRarity, string> = {
    common: "bg-gradient-to-b from-surface-muted/90 to-surface-card border-fg-subtle/25 shadow-sm",
    rare: "bg-gradient-to-b from-brand-400/15 to-surface-card border-brand-400/50 shadow-[0_0_14px_rgba(56,189,248,0.12)]",
    epic: "bg-gradient-to-b from-violet-400/15 to-surface-card border-violet-400/50 shadow-[0_0_14px_rgba(167,139,250,0.12)]",
    legendary: "bg-gradient-to-b from-amber-400/18 to-surface-card border-amber-400/55 shadow-[0_0_16px_rgba(251,191,36,0.14)]",
};

const UNLOCKED_CARD_STYLES: Record<AchievementRarity, string> = {
    common: "bg-gradient-to-r from-surface-muted/60 to-surface-card border-fg-subtle/25 shadow-sm",
    rare: "bg-gradient-to-r from-brand-400/10 to-surface-card border-brand-400/45 shadow-[0_0_12px_rgba(56,189,248,0.1)]",
    epic: "bg-gradient-to-r from-violet-400/10 to-surface-card border-violet-400/45 shadow-[0_0_12px_rgba(167,139,250,0.1)]",
    legendary: "bg-gradient-to-r from-amber-400/12 to-surface-card border-amber-400/50 shadow-[0_0_14px_rgba(251,191,36,0.12)]",
};

const LOCKED_TILE_STYLES = "opacity-55 bg-surface-muted/10 border-dashed border-surface-border/80 saturate-[0.35]";
const LOCKED_CARD_STYLES = "opacity-55 bg-surface-muted/10 border-dashed border-surface-border/80 saturate-[0.35]";

export function AchievementTile({
    achievement,
}: {
    achievement: AchievementDisplayItem;
}) {
    const styles = RARITY_STYLES[achievement.rarity];
    const Icon = ICON_MAP[achievement.icon] ?? Trophy;
    const locked = !achievement.unlocked;
    const [showHint, setShowHint] = useState(false);

    return (
        <button
            type="button"
            onClick={() => setShowHint((value) => !value)}
            className={cn(
                "relative flex flex-col items-center text-center gap-2 rounded-2xl border p-2.5 sm:p-3 min-h-[7.5rem] transition-colors w-full",
                locked
                    ? LOCKED_TILE_STYLES
                    : cn("border-2", UNLOCKED_TILE_STYLES[achievement.rarity])
            )}
            aria-expanded={showHint}
        >
            {!locked && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-success/15 border border-success/35 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-success" strokeWidth={3} />
                </span>
            )}
            <div
                className={cn(
                    "w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border",
                    locked ? "bg-surface-muted/40 border-surface-border opacity-80" : cn(styles.badge, "scale-105")
                )}
            >
                <Icon className={cn("w-5 h-5", locked ? "text-fg-subtle" : styles.icon)} />
            </div>
            <p className={cn(
                "text-[10px] sm:text-[11px] font-black leading-tight line-clamp-2 w-full",
                locked ? "text-fg-subtle" : cn(styles.label, "text-fg")
            )}>
                {achievement.title}
            </p>
            {achievement.progress && !achievement.unlocked && (
                <p className="text-[9px] font-bold text-fg-subtle tabular-nums">
                    {formatProgress(achievement.progress.current, achievement.progress.target)}
                </p>
            )}
            <div className="mt-auto flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-fg-subtle">
                <Info className="w-3 h-3" />
                {showHint ? "Hide" : "How"}
            </div>
            {showHint && (
                <p className="text-[9px] leading-snug text-fg-muted border-t border-surface-border/60 pt-2">
                    {achievement.unlockHint}
                </p>
            )}
        </button>
    );
}

export function AchievementCard({
    achievement,
    compact = false,
}: {
    achievement: AchievementDisplayItem;
    compact?: boolean;
}) {
    const styles = RARITY_STYLES[achievement.rarity];
    const Icon = ICON_MAP[achievement.icon] ?? Trophy;
    const locked = !achievement.unlocked;
    const [showHint, setShowHint] = useState(false);

    return (
        <button
            type="button"
            onClick={() => setShowHint((value) => !value)}
            className={cn(
                "relative flex gap-3 rounded-2xl border p-3 sm:p-4 transition-colors w-full text-left",
                locked
                    ? LOCKED_CARD_STYLES
                    : cn("border-2", UNLOCKED_CARD_STYLES[achievement.rarity])
            )}
            aria-expanded={showHint}
        >
            {!locked && (
                <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-success/15 border border-success/35 flex items-center justify-center">
                    <Check className="w-3 h-3 text-success" strokeWidth={3} />
                </span>
            )}
            <div
                className={cn(
                    "w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border",
                    locked ? "bg-surface-muted/40 border-surface-border opacity-80" : cn(styles.badge, "scale-105")
                )}
            >
                <Icon className={cn("w-5 h-5", locked ? "text-fg-subtle" : styles.icon)} />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2 pr-5">
                    <p className={cn(
                        "text-sm font-black leading-tight",
                        locked ? "text-fg-subtle" : cn(styles.label, "text-fg")
                    )}>
                        {achievement.title}
                    </p>
                    {!compact && (
                        <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest shrink-0 px-1.5 py-0.5 rounded-md border",
                            locked ? "bg-surface-muted/40 text-fg-subtle border-surface-border opacity-80" : styles.badge
                        )}>
                            {achievement.rarity}
                        </span>
                    )}
                </div>
                <p className={cn(
                    "text-[11px] mt-1 leading-relaxed",
                    locked ? "text-fg-subtle" : "text-fg-muted"
                )}>
                    {achievement.description}
                </p>
                {achievement.progress && !achievement.unlocked && (
                    <p className="text-[10px] font-bold text-fg-subtle mt-2 tabular-nums">
                        {formatProgress(achievement.progress.current, achievement.progress.target)}
                    </p>
                )}
                <p className="mt-2 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-brand-400">
                    <Info className="w-3 h-3" />
                    {showHint ? "Hide unlock details" : "How to unlock"}
                </p>
                {showHint && (
                    <div className="mt-2 rounded-xl border border-surface-border bg-surface-muted/40 p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle mb-1">How to achieve it</p>
                        <p className="text-xs text-fg-muted leading-relaxed">{achievement.unlockHint}</p>
                    </div>
                )}
            </div>
        </button>
    );
}

export function AchievementsList({
    achievements,
    compact = false,
    layout = "list",
}: {
    achievements: AchievementDisplayItem[];
    compact?: boolean;
    layout?: "list" | "grid";
}) {
    if (layout === "grid") {
        return (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {achievements.map((achievement) => (
                    <AchievementTile key={achievement.id} achievement={achievement} />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {achievements.map((achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} compact={compact} />
            ))}
        </div>
    );
}

export function rarityLabel(rarity: AchievementRarity): string {
    return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}
