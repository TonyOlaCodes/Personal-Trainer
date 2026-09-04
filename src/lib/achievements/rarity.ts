export const ACHIEVEMENT_RARITIES = [
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
] as const;

export type AchievementRarity = (typeof ACHIEVEMENT_RARITIES)[number];

export const RARITY_RANK: Record<AchievementRarity, number> = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
};

export function rarityAtLeast(
    a: AchievementRarity | null,
    min: AchievementRarity
): boolean {
    if (a == null) return false;
    return RARITY_RANK[a] >= RARITY_RANK[min];
}

export function nextRarity(r: AchievementRarity | null): AchievementRarity | null {
    if (r == null) return "common";
    const idx = ACHIEVEMENT_RARITIES.indexOf(r);
    if (idx < 0 || idx >= ACHIEVEMENT_RARITIES.length - 1) return null;
    return ACHIEVEMENT_RARITIES[idx + 1] ?? null;
}

export function highestRarity(list: AchievementRarity[]): AchievementRarity | null {
    if (list.length === 0) return null;
    let best: AchievementRarity | null = null;
    for (const r of list) {
        if (best == null || RARITY_RANK[r] > RARITY_RANK[best]) {
            best = r;
        }
    }
    return best;
}

/**
 * Tailwind-oriented design tokens used everywhere.
 *
 * Suggested CSS custom properties for globals.css:
 *   --achievement-common-text / --achievement-common-border / --achievement-common-badge
 *   --achievement-common-glow / --achievement-common-soft-bg / --achievement-common-accent
 *   --achievement-uncommon-text / --achievement-uncommon-border / --achievement-uncommon-badge
 *   --achievement-uncommon-glow / --achievement-uncommon-soft-bg / --achievement-uncommon-accent
 *   --achievement-rare-text / --achievement-rare-border / --achievement-rare-badge
 *   --achievement-rare-glow / --achievement-rare-soft-bg / --achievement-rare-accent
 *   --achievement-epic-text / --achievement-epic-border / --achievement-epic-badge
 *   --achievement-epic-glow / --achievement-epic-soft-bg / --achievement-epic-accent
 *   --achievement-legendary-text / --achievement-legendary-border / --achievement-legendary-badge
 *   --achievement-legendary-glow / --achievement-legendary-soft-bg / --achievement-legendary-accent
 */
export const RARITY_TOKENS: Record<
    AchievementRarity,
    {
        label: string;
        text: string;
        border: string;
        badge: string;
        glow: string;
        softBg: string;
        notificationAccent: string;
    }
> = {
    common: {
        label: "Common",
        text: "text-fg-muted",
        border: "border-surface-border",
        badge: "bg-surface-muted text-fg-muted border-surface-border",
        glow: "shadow-none",
        softBg: "bg-surface-muted/40",
        notificationAccent: "border-l-surface-border",
    },
    uncommon: {
        label: "Uncommon",
        text: "text-emerald-400",
        border: "border-emerald-400/40",
        badge: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
        glow: "shadow-[0_0_10px_rgba(52,211,153,0.1)]",
        softBg: "bg-emerald-400/10",
        notificationAccent: "border-l-emerald-400",
    },
    rare: {
        label: "Rare",
        text: "text-brand-400",
        border: "border-brand-400/40",
        badge: "bg-brand-400/10 text-brand-300 border-brand-400/25",
        glow: "shadow-[0_0_12px_rgba(56,189,248,0.12)]",
        softBg: "bg-brand-400/10",
        notificationAccent: "border-l-brand-400",
    },
    epic: {
        label: "Epic",
        text: "text-violet-400",
        border: "border-violet-400/40",
        badge: "bg-violet-400/10 text-violet-300 border-violet-400/25",
        glow: "shadow-[0_0_14px_rgba(167,139,250,0.14)]",
        softBg: "bg-violet-400/10",
        notificationAccent: "border-l-violet-400",
    },
    legendary: {
        label: "Legendary",
        text: "text-amber-400",
        border: "border-amber-400/50",
        badge: "bg-amber-400/10 text-amber-300 border-amber-400/25",
        glow: "shadow-[0_0_20px_rgba(251,191,36,0.22)]",
        softBg: "bg-amber-400/12",
        notificationAccent: "border-l-amber-400",
    },
};

export type StreakDisplay =
    | { mode: "single"; days: number }
    | { mode: "dual"; current: number; best: number };

export function formatStreakDisplay(current: number, best: number): StreakDisplay {
    if (current === best) {
        return { mode: "single", days: current };
    }
    return { mode: "dual", current, best };
}
