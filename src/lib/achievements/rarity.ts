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
 * Single source of truth for rarity styling across cards, modals, popups,
 * the profile showcase, notifications and filters.
 *
 * Every value is a literal Tailwind class string so the JIT compiler can see
 * it — never build these class names dynamically at runtime.
 *
 * Hierarchy is intentional and increases with rank:
 * border → icon container → rarity label → background tint → glow → progress bar.
 * Colours are fixed (not `brand-*`) so rarity reads the same in every theme.
 */
export interface RarityStyleTokens {
    label: string;
    /** Rarity word and other text accents. */
    text: string;
    /** Icon glyph colour. */
    icon: string;
    /** Card border — thickness/opacity climbs with rank. */
    border: string;
    /** Icon container background + border. */
    iconWrap: string;
    /** Soft card background tint (gradient for epic/legendary). */
    cardBg: string;
    /** Outer glow for cards and tiles. */
    glow: string;
    /** Heavier glow for hero moments (unlock/upgrade popup). */
    glowStrong: string;
    /** Progress bar fill for the currently earned rarity. */
    bar: string;
    /** Compact pill used by rarity filters and inline badges. */
    chip: string;
    /** Left accent border for notification rows. */
    notificationAccent: string;
}

export const RARITY_TOKENS: Record<AchievementRarity, RarityStyleTokens> = {
    common: {
        label: "Common",
        text: "text-slate-200",
        icon: "text-slate-300",
        border: "border-slate-400/40",
        iconWrap: "bg-slate-400/10 border-slate-400/30",
        cardBg: "bg-slate-400/[0.04]",
        glow: "shadow-[0_0_14px_-6px_rgba(203,213,225,0.35)]",
        glowStrong: "shadow-[0_0_30px_-8px_rgba(203,213,225,0.5)]",
        bar: "bg-slate-300",
        chip: "bg-slate-400/15 text-slate-200 border-slate-400/40",
        notificationAccent: "border-l-slate-400",
    },
    uncommon: {
        label: "Uncommon",
        text: "text-emerald-300",
        icon: "text-emerald-300",
        border: "border-emerald-400/60",
        iconWrap: "bg-emerald-400/15 border-emerald-400/40",
        cardBg: "bg-emerald-500/[0.07]",
        glow: "shadow-[0_0_18px_-4px_rgba(52,211,153,0.35)]",
        glowStrong: "shadow-[0_0_40px_-6px_rgba(52,211,153,0.55)]",
        bar: "bg-emerald-400",
        chip: "bg-emerald-400/15 text-emerald-200 border-emerald-400/45",
        notificationAccent: "border-l-emerald-400",
    },
    rare: {
        label: "Rare",
        text: "text-sky-300",
        icon: "text-sky-300",
        border: "border-sky-400/65",
        iconWrap: "bg-sky-400/15 border-sky-400/45",
        cardBg: "bg-sky-500/[0.09]",
        glow: "shadow-[0_0_22px_-4px_rgba(56,189,248,0.4)]",
        glowStrong: "shadow-[0_0_44px_-6px_rgba(56,189,248,0.6)]",
        bar: "bg-sky-400",
        chip: "bg-sky-400/15 text-sky-200 border-sky-400/50",
        notificationAccent: "border-l-sky-400",
    },
    epic: {
        label: "Epic",
        text: "text-violet-300",
        icon: "text-violet-300",
        border: "border-violet-400/70",
        iconWrap: "bg-violet-400/20 border-violet-400/50",
        cardBg: "bg-gradient-to-br from-violet-500/15 via-violet-500/[0.06] to-transparent",
        glow: "shadow-[0_0_26px_-4px_rgba(167,139,250,0.5)]",
        glowStrong: "shadow-[0_0_50px_-6px_rgba(167,139,250,0.7)]",
        bar: "bg-violet-400",
        chip: "bg-violet-400/20 text-violet-200 border-violet-400/55",
        notificationAccent: "border-l-violet-400",
    },
    legendary: {
        label: "Legendary",
        text: "text-amber-300",
        icon: "text-amber-200",
        border: "border-amber-400/80",
        iconWrap: "bg-amber-400/20 border-amber-300/60",
        cardBg: "bg-gradient-to-br from-amber-400/18 via-amber-500/[0.08] to-transparent",
        glow: "shadow-[0_0_30px_-4px_rgba(251,191,36,0.55),inset_0_1px_0_0_rgba(253,230,138,0.25)]",
        glowStrong: "shadow-[0_0_60px_-8px_rgba(251,191,36,0.75),inset_0_1px_0_0_rgba(253,230,138,0.35)]",
        bar: "bg-gradient-to-r from-amber-200 to-amber-400",
        chip: "bg-amber-400/20 text-amber-200 border-amber-300/60",
        notificationAccent: "border-l-amber-400",
    },
};

/**
 * Locked achievements sit clearly below Common: dashed border, no glow,
 * muted icon and text, low-contrast progress.
 */
export const LOCKED_TOKENS: RarityStyleTokens = {
    label: "Locked",
    text: "text-fg-subtle",
    icon: "text-fg-subtle",
    border: "border-dashed border-surface-border/70",
    iconWrap: "bg-surface-muted/30 border-surface-border/70",
    cardBg: "bg-surface-muted/[0.06]",
    glow: "shadow-none",
    glowStrong: "shadow-none",
    bar: "bg-fg-subtle/30",
    chip: "bg-surface-muted/40 text-fg-subtle border-surface-border",
    notificationAccent: "border-l-surface-border",
};

/** Extra dimming applied to locked cards on top of {@link LOCKED_TOKENS}. */
export const LOCKED_CARD_OPACITY = "opacity-60";

/** Legendary-only shimmer (see `.rarity-shimmer` in globals.css). */
export const LEGENDARY_SHIMMER_CLASS = "rarity-shimmer";

/** Resolve styling for a rarity, falling back to locked styling when unearned. */
export function getRarityTokens(
    rarity: AchievementRarity | null | undefined,
    locked = false
): RarityStyleTokens {
    if (locked || !rarity) return LOCKED_TOKENS;
    return RARITY_TOKENS[rarity] ?? RARITY_TOKENS.common;
}

/**
 * Achievement notifications store `familyKey:rarity[:pN]` as the entity id,
 * so the bell can tint each row without extra columns.
 */
export function rarityFromAchievementEntityId(
    entityId: string | null | undefined
): AchievementRarity | null {
    if (!entityId) return null;
    for (const part of entityId.split(":")) {
        if ((ACHIEVEMENT_RARITIES as readonly string[]).includes(part)) {
            return part as AchievementRarity;
        }
    }
    return null;
}

export type StreakDisplay =
    | { mode: "single"; days: number }
    | { mode: "dual"; current: number; best: number };

export function formatStreakDisplay(current: number, best: number): StreakDisplay {
    if (current === best) {
        return { mode: "single", days: current };
    }
    return { mode: "dual", current, best };
}
