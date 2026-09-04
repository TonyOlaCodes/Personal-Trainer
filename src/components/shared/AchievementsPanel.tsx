"use client";

import { useMemo, useState } from "react";
import {
    Award, Calendar, Check, ClipboardList, Clock, Compass, Copy, Dumbbell,
    Flame, FolderOpen, Info, Layers, Lock, MessageSquare, Scale, Share2, Star,
    Target, TrendingUp, Trophy, Users, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RARITY_TOKENS, formatStreakDisplay, type AchievementRarity } from "@/lib/achievements/rarity";
import type { AchievementIcon } from "@/lib/achievements/types";
import type { AchievementDisplayItem, CoachAchievementDisplayItem, ProgressiveDisplayItem } from "@/lib/achievements";

export const ACHIEVEMENT_ICON_MAP: Record<
    AchievementIcon | "compass" | "layers" | "award",
    React.ComponentType<{ className?: string }>
> = {
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
    compass: Compass,
    layers: Layers,
    award: Award,
};

function isProgressiveItem(item: AchievementDisplayItem): item is ProgressiveDisplayItem {
    return "kind" in item && (item.kind === "progressive" || item.kind === "special");
}

function formatMetric(value: number, unit: string): string {
    const rounded = unit === "hours"
        ? (Math.round(value * 10) / 10).toLocaleString()
        : Math.round(value).toLocaleString();
    return unit ? `${rounded} ${unit}` : rounded;
}

function rarityLabel(rarity: AchievementRarity | null | undefined, locked: boolean): string {
    if (locked || !rarity) return "Locked";
    return RARITY_TOKENS[rarity].label;
}

export function AchievementTile({
    achievement,
    onOpen,
}: {
    achievement: AchievementDisplayItem;
    onOpen?: (item: AchievementDisplayItem) => void;
}) {
    if (isProgressiveItem(achievement)) {
        return <ProgressiveAchievementCard achievement={achievement} compact onOpen={onOpen} />;
    }
    return <LegacyCoachTile achievement={achievement} />;
}

export function AchievementCard({
    achievement,
    onOpen,
}: {
    achievement: AchievementDisplayItem;
    onOpen?: (item: AchievementDisplayItem) => void;
}) {
    if (isProgressiveItem(achievement)) {
        return <ProgressiveAchievementCard achievement={achievement} onOpen={onOpen} />;
    }
    return <LegacyCoachTile achievement={achievement} />;
}

function LegacyCoachTile({ achievement }: { achievement: CoachAchievementDisplayItem }) {
    const styles = RARITY_TOKENS[achievement.rarity as AchievementRarity] ?? RARITY_TOKENS.common;
    const Icon = ACHIEVEMENT_ICON_MAP[achievement.icon as AchievementIcon] ?? Trophy;
    const locked = !achievement.unlocked;

    return (
        <div
            className={cn(
                "relative flex flex-col items-center text-center gap-2 rounded-2xl border p-3 min-h-[7.5rem]",
                locked
                    ? "opacity-55 bg-surface-muted/10 border-dashed border-surface-border/80"
                    : cn("border-2", styles.softBg, styles.border, styles.glow)
            )}
        >
            {!locked && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-success/15 border border-success/35 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-success" strokeWidth={3} />
                </span>
            )}
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", locked ? "bg-surface-muted/40" : styles.badge)}>
                <Icon className={cn("w-5 h-5", locked ? "text-fg-subtle" : styles.text)} />
            </div>
            <p className={cn("text-[11px] font-black leading-tight line-clamp-2", locked ? "text-fg-subtle" : "text-fg")}>
                {achievement.title}
            </p>
        </div>
    );
}

export function ProgressiveAchievementCard({
    achievement,
    compact = false,
    onOpen,
    selected = false,
}: {
    achievement: ProgressiveDisplayItem;
    compact?: boolean;
    onOpen?: (item: ProgressiveDisplayItem) => void;
    selected?: boolean;
}) {
    const locked = !achievement.unlocked;
    const secretLocked = achievement.secret && locked;
    const rarity = achievement.highestRarity;
    const tokens = rarity ? RARITY_TOKENS[rarity] : RARITY_TOKENS.common;
    const Icon = ACHIEVEMENT_ICON_MAP[achievement.icon] ?? Trophy;
    const next = achievement.nextRarity;
    const progress = achievement.progress;
    const progressPct = progress
        ? Math.min(100, Math.round((progress.current / Math.max(progress.target, 1)) * 100))
        : locked
          ? 0
          : 100;

    const streakLine = useMemo(() => {
        if (
            achievement.currentStreakDays == null
            || achievement.bestStreakDays == null
        ) {
            return null;
        }
        const display = formatStreakDisplay(
            achievement.currentStreakDays,
            achievement.bestStreakDays
        );
        if (display.mode === "single") {
            return `Streak: ${display.days} ${achievement.unit || "days"}`;
        }
        return `Current: ${display.current} · Best: ${display.best}`;
    }, [achievement]);

    return (
        <button
            type="button"
            onClick={() => onOpen?.(achievement)}
            className={cn(
                "relative w-full text-left rounded-2xl border transition-all",
                compact ? "p-3" : "p-4",
                locked
                    ? "bg-surface-muted/10 border-dashed border-surface-border/80 opacity-70"
                    : cn("bg-surface-card border-2", tokens.border, tokens.glow),
                selected && "ring-2 ring-brand-400/50",
                rarity === "legendary" && !locked && "animate-[pulse_4s_ease-in-out_infinite]"
            )}
        >
            <div className="flex items-start gap-3">
                <div
                    className={cn(
                        "rounded-xl flex items-center justify-center shrink-0 border",
                        compact ? "w-10 h-10" : "w-12 h-12",
                        locked ? "bg-surface-muted/40 border-surface-border" : cn(tokens.badge, tokens.border)
                    )}
                >
                    {secretLocked ? (
                        <Lock className="w-5 h-5 text-fg-subtle" />
                    ) : (
                        <Icon className={cn("w-5 h-5", locked ? "text-fg-subtle" : tokens.text)} />
                    )}
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className={cn(
                                "font-black uppercase tracking-wide leading-tight",
                                compact ? "text-xs" : "text-sm",
                                locked ? "text-fg-subtle" : "text-fg"
                            )}>
                                {achievement.title}
                            </p>
                            <p className={cn(
                                "text-[10px] font-black uppercase tracking-widest mt-0.5",
                                locked ? "text-fg-subtle" : tokens.text
                            )}>
                                {rarityLabel(rarity, locked)}
                            </p>
                        </div>
                        {!locked && (
                            <span className="w-5 h-5 rounded-full bg-success/15 border border-success/35 flex items-center justify-center shrink-0">
                                <Check className="w-3 h-3 text-success" strokeWidth={3} />
                            </span>
                        )}
                    </div>

                    {achievement.kind === "progressive" && (
                        <>
                            <p className="text-xs text-fg-muted tabular-nums">
                                {locked && progress
                                    ? `${progress.current.toLocaleString()} / ${progress.target.toLocaleString()}`
                                    : rarity === "legendary" && !achievement.prestigeNext
                                      ? `${formatMetric(achievement.metricValue, achievement.unit)} · Legendary achieved`
                                      : formatMetric(achievement.metricValue, achievement.unit)}
                            </p>

                            {streakLine && (
                                <p className="text-[11px] font-bold text-fg-muted">{streakLine}</p>
                            )}

                            {progress && (
                                <div className="space-y-1 pt-0.5">
                                    <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all",
                                                locked ? "bg-fg-subtle/40" : tokens.text.replace("text-", "bg-")
                                            )}
                                            style={{
                                                width: `${progressPct}%`,
                                                backgroundColor: locked
                                                    ? undefined
                                                    : undefined,
                                            }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-fg-subtle">
                                        <span>
                                            {progress.current.toLocaleString()} / {progress.target.toLocaleString()}
                                        </span>
                                        <span>
                                            {achievement.prestigeNext
                                                ? `Next: Prestige ${achievement.prestigeNext}`
                                                : next
                                                  ? `Next: ${RARITY_TOKENS[next].label}`
                                                  : rarity === "legendary"
                                                    ? "Max rarity"
                                                    : "Next: Common"}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {achievement.kind === "special" && !secretLocked && (
                        <p className="text-[11px] text-fg-muted line-clamp-2">{achievement.description}</p>
                    )}
                    {secretLocked && (
                        <p className="text-[11px] text-fg-subtle italic">Secret Achievement</p>
                    )}
                </div>
            </div>
        </button>
    );
}

export function AchievementDetailPanel({
    achievement,
    onClose,
}: {
    achievement: ProgressiveDisplayItem;
    onClose?: () => void;
}) {
    const rarity = achievement.highestRarity;
    const tokens = rarity ? RARITY_TOKENS[rarity] : RARITY_TOKENS.common;
    const Icon = ACHIEVEMENT_ICON_MAP[achievement.icon] ?? Trophy;
    const locked = !achievement.unlocked;
    const secretLocked = achievement.secret && locked;

    return (
        <div className="space-y-5">
            <div className="flex items-start gap-4">
                <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0",
                    locked ? "bg-surface-muted/40 border-surface-border" : cn(tokens.badge, tokens.border, tokens.glow)
                )}>
                    {secretLocked ? <Lock className="w-7 h-7 text-fg-subtle" /> : (
                        <Icon className={cn("w-7 h-7", locked ? "text-fg-subtle" : tokens.text)} />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-lg font-black text-fg tracking-tight">{achievement.title}</p>
                    <p className={cn("text-[10px] font-black uppercase tracking-widest mt-1", locked ? "text-fg-subtle" : tokens.text)}>
                        {rarityLabel(rarity, locked)}
                    </p>
                    {!secretLocked && (
                        <p className="text-sm text-fg-muted mt-2 leading-relaxed">{achievement.description}</p>
                    )}
                </div>
                {onClose && (
                    <button type="button" onClick={onClose} className="btn-ghost text-xs">Close</button>
                )}
            </div>

            {achievement.kind === "progressive" && (
                <>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border border-surface-border bg-surface-muted/20 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Current</p>
                            <p className="font-bold text-fg mt-1 tabular-nums">
                                {formatMetric(achievement.metricValue, achievement.unit)}
                            </p>
                        </div>
                        <div className="rounded-xl border border-surface-border bg-surface-muted/20 p-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Next</p>
                            <p className="font-bold text-fg mt-1">
                                {achievement.prestigeNext
                                    ? `Prestige ${achievement.prestigeNext}`
                                    : achievement.nextRarity
                                      ? `${RARITY_TOKENS[achievement.nextRarity].label} · ${achievement.progress?.target ?? "—"}`
                                      : rarity === "legendary"
                                        ? "Legendary complete"
                                        : "Common"}
                            </p>
                        </div>
                    </div>

                    {(achievement.currentStreakDays != null && achievement.bestStreakDays != null) && (
                        <p className="text-sm text-fg-muted">
                            {(() => {
                                const d = formatStreakDisplay(
                                    achievement.currentStreakDays,
                                    achievement.bestStreakDays
                                );
                                return d.mode === "single"
                                    ? `Streak: ${d.days} ${achievement.unit}`
                                    : `Current: ${d.current} ${achievement.unit} · Best: ${d.best} ${achievement.unit}`;
                            })()}
                        </p>
                    )}

                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Progression</p>
                        {achievement.tierHistory.map((tier) => {
                            const t = RARITY_TOKENS[tier.rarity];
                            const done = tier.unlocked;
                            const isCurrentNext =
                                !done
                                && achievement.nextRarity === tier.rarity
                                && achievement.progress;
                            return (
                                <div
                                    key={tier.rarity}
                                    className={cn(
                                        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
                                        done ? cn(t.softBg, t.border) : "border-surface-border/60 bg-surface-muted/10"
                                    )}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        {done ? (
                                            <Check className={cn("w-4 h-4", t.text)} />
                                        ) : (
                                            <Lock className="w-4 h-4 text-fg-subtle" />
                                        )}
                                        <span className={cn("text-sm font-bold", done ? t.text : "text-fg-subtle")}>
                                            {t.label}
                                        </span>
                                    </div>
                                    <div className="text-right text-xs font-bold tabular-nums text-fg-muted">
                                        {isCurrentNext
                                            ? `${achievement.progress!.current.toLocaleString()} / ${tier.requirement.toLocaleString()}`
                                            : tier.requirement.toLocaleString()}
                                        {done && tier.unlockedAt && (
                                            <p className="text-[10px] font-medium text-fg-subtle mt-0.5">
                                                {new Date(tier.unlockedAt).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

export function AchievementsList({
    achievements,
    layout = "list",
    onOpen,
}: {
    achievements: AchievementDisplayItem[];
    layout?: "grid" | "list";
    onOpen?: (item: AchievementDisplayItem) => void;
}) {
    if (layout === "grid") {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {achievements.map((achievement) => (
                    <AchievementTile key={achievement.id} achievement={achievement} onOpen={onOpen} />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-2.5">
            {achievements.map((achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} onOpen={onOpen} />
            ))}
        </div>
    );
}

/** Tiny hint chip used in older flows — kept for compatibility. */
export function AchievementHint({ text }: { text: string }) {
    return (
        <p className="text-[9px] leading-snug text-fg-muted border-t border-surface-border/60 pt-2 flex items-start gap-1">
            <Info className="w-3 h-3 shrink-0 mt-0.5" />
            {text}
        </p>
    );
}
