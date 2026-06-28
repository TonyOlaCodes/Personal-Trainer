"use client";

import {
    Calendar, ClipboardList, Clock, Copy, Dumbbell, Flame, FolderOpen,
    MessageSquare, Scale, Share2, Star, Target, TrendingUp, Trophy, Users, Zap,
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

    return (
        <div
            className={cn(
                "relative flex gap-3 rounded-2xl border p-3 sm:p-4 transition-colors",
                locked ? "opacity-55 bg-surface-muted/20 border-surface-border" : "bg-surface-card",
                !locked && styles.ring
            )}
        >
            <div
                className={cn(
                    "w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border",
                    locked ? "bg-surface-muted border-surface-border" : styles.badge
                )}
            >
                <Icon className={cn("w-5 h-5", locked ? "text-fg-subtle" : styles.icon)} />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm font-black leading-tight", locked ? "text-fg-muted" : "text-fg")}>
                        {achievement.title}
                    </p>
                    {!compact && (
                        <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest shrink-0 px-1.5 py-0.5 rounded-md border",
                            locked ? "bg-surface-muted text-fg-subtle border-surface-border" : styles.badge
                        )}>
                            {achievement.rarity}
                        </span>
                    )}
                </div>
                <p className="text-[11px] text-fg-muted mt-1 leading-relaxed">{achievement.description}</p>
                {achievement.progress && !achievement.unlocked && (
                    <p className="text-[10px] font-bold text-fg-subtle mt-2 tabular-nums">
                        {formatProgress(achievement.progress.current, achievement.progress.target)}
                    </p>
                )}
            </div>
        </div>
    );
}

export function AchievementsList({
    achievements,
    compact = false,
}: {
    achievements: AchievementDisplayItem[];
    compact?: boolean;
}) {
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
