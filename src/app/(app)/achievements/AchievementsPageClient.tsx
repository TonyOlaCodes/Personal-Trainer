"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Star, Trophy } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import {
    AchievementDetailPanel,
    ProgressiveAchievementCard,
} from "@/components/shared/AchievementsPanel";
import { ModalOverlay } from "@/components/shared/ModalOverlay";
import { cn } from "@/lib/utils";
import { RARITY_TOKENS, type AchievementRarity } from "@/lib/achievements/rarity";
import type { AchievementCategory } from "@/lib/achievements/types";
import type { ProgressiveDisplayItem } from "@/lib/achievements";

type SectionFilter = "all" | "progressive" | "special";
type CategoryFilter = "all" | AchievementCategory;
type RarityFilter = "all" | AchievementRarity;

const CATEGORY_FILTERS: Array<{ id: CategoryFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "training", label: "Training" },
    { id: "consistency", label: "Consistency" },
    { id: "prs", label: "PRs" },
    { id: "checkins", label: "Check-ins" },
    { id: "tracking", label: "Tracking" },
    { id: "plans", label: "Plans" },
    { id: "social", label: "Social" },
    { id: "special", label: "Special" },
    { id: "meta", label: "Meta" },
];

const RARITY_FILTERS: Array<{ id: RarityFilter; label: string }> = [
    { id: "all", label: "All rarities" },
    { id: "common", label: "Common" },
    { id: "uncommon", label: "Uncommon" },
    { id: "rare", label: "Rare" },
    { id: "epic", label: "Epic" },
    { id: "legendary", label: "Legendary" },
];

interface Props {
    initialAchievements: ProgressiveDisplayItem[];
    featuredKeys: string[];
    canFeature: boolean;
}

export function AchievementsPageClient({
    initialAchievements,
    featuredKeys: initialFeatured,
    canFeature,
}: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [achievements, setAchievements] = useState(initialAchievements);
    const [featuredKeys, setFeaturedKeys] = useState(initialFeatured);
    const [section, setSection] = useState<SectionFilter>("all");
    const [category, setCategory] = useState<CategoryFilter>("all");
    const [rarity, setRarity] = useState<RarityFilter>("all");
    const [selected, setSelected] = useState<ProgressiveDisplayItem | null>(null);
    const [featuring, setFeaturing] = useState(false);
    const [savingFeatured, setSavingFeatured] = useState(false);

    useEffect(() => {
        setAchievements(initialAchievements);
    }, [initialAchievements]);

    useEffect(() => {
        const focus = searchParams.get("focus");
        if (!focus) return;
        const match = achievements.find((a) => a.id === focus);
        if (match) setSelected(match);
    }, [searchParams, achievements]);

    const unlockedCount = achievements.filter((a) => a.unlocked).length;

    const filtered = useMemo(() => {
        return achievements.filter((item) => {
            if (section === "progressive" && item.kind !== "progressive") return false;
            if (section === "special" && item.kind !== "special") return false;
            if (category !== "all" && item.category !== category) return false;
            if (rarity !== "all") {
                if (!item.unlocked) return false;
                if ((item.highestRarity ?? item.rarity) !== rarity) return false;
            }
            return true;
        });
    }, [achievements, section, category, rarity]);

    const progressive = filtered.filter((a) => a.kind === "progressive");
    const special = filtered.filter((a) => a.kind === "special");

    const toggleFeatured = async (key: string) => {
        if (!canFeature) return;
        setSavingFeatured(true);
        try {
            const next = featuredKeys.includes(key)
                ? featuredKeys.filter((k) => k !== key)
                : [...featuredKeys, key].slice(0, 3);
            const res = await fetch("/api/user/achievements/featured", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keys: next }),
            });
            if (res.ok) {
                const data = await res.json();
                setFeaturedKeys(data.keys ?? next);
                router.refresh();
            }
        } finally {
            setSavingFeatured(false);
        }
    };

    return (
        <>
            <TopBar title="Achievements" subtitle={`${unlockedCount} / ${achievements.length} unlocked`} />
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
                <div className="flex flex-wrap gap-2">
                    {([
                        ["all", "All"],
                        ["progressive", "Progressive"],
                        ["special", "Special"],
                    ] as const).map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setSection(id)}
                            className={cn(
                                "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors",
                                section === id
                                    ? "bg-brand-500/15 border-brand-500/40 text-brand-300"
                                    : "bg-surface-muted/30 border-surface-border text-fg-muted"
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                    {CATEGORY_FILTERS.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => setCategory(f.id)}
                            className={cn(
                                "shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold border",
                                category === f.id
                                    ? "bg-surface-card border-brand-400/40 text-fg"
                                    : "border-surface-border/60 text-fg-subtle"
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                    {RARITY_FILTERS.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => setRarity(f.id)}
                            className={cn(
                                "shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold border",
                                rarity === f.id
                                    ? f.id === "all"
                                        ? "bg-surface-card border-brand-400/40 text-fg"
                                        : cn(RARITY_TOKENS[f.id].badge, RARITY_TOKENS[f.id].border)
                                    : "border-surface-border/60 text-fg-subtle"
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {canFeature && (
                    <div className="card p-4 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-black text-fg">Feature on profile</p>
                            <p className="text-xs text-fg-muted mt-0.5">
                                Pick up to 3 earned achievements ({featuredKeys.length}/3).
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFeaturing((v) => !v)}
                            className="btn-secondary text-xs"
                        >
                            {featuring ? "Done" : "Edit"}
                        </button>
                    </div>
                )}

                {(section === "all" || section === "progressive") && progressive.length > 0 && (
                    <section className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-brand-400" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-fg">Progressive</h2>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                            {progressive.map((item) => (
                                <div key={item.id} className="relative">
                                    <ProgressiveAchievementCard
                                        achievement={item}
                                        onOpen={setSelected}
                                        selected={selected?.id === item.id}
                                    />
                                    {featuring && item.unlocked && (
                                        <button
                                            type="button"
                                            disabled={savingFeatured}
                                            onClick={() => void toggleFeatured(item.id)}
                                            className={cn(
                                                "absolute top-3 left-3 w-8 h-8 rounded-full border flex items-center justify-center",
                                                featuredKeys.includes(item.id)
                                                    ? "bg-amber-400/20 border-amber-400/50 text-amber-300"
                                                    : "bg-surface-card/90 border-surface-border text-fg-subtle"
                                            )}
                                            aria-label="Feature on profile"
                                        >
                                            <Star className={cn("w-4 h-4", featuredKeys.includes(item.id) && "fill-current")} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {(section === "all" || section === "special") && special.length > 0 && (
                    <section className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-amber-400" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-fg">Special</h2>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                            {special.map((item) => (
                                <div key={item.id} className="relative">
                                    <ProgressiveAchievementCard
                                        achievement={item}
                                        onOpen={setSelected}
                                    />
                                    {featuring && item.unlocked && (
                                        <button
                                            type="button"
                                            disabled={savingFeatured}
                                            onClick={() => void toggleFeatured(item.id)}
                                            className={cn(
                                                "absolute top-3 left-3 w-8 h-8 rounded-full border flex items-center justify-center",
                                                featuredKeys.includes(item.id)
                                                    ? "bg-amber-400/20 border-amber-400/50 text-amber-300"
                                                    : "bg-surface-card/90 border-surface-border text-fg-subtle"
                                            )}
                                        >
                                            <Star className={cn("w-4 h-4", featuredKeys.includes(item.id) && "fill-current")} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {filtered.length === 0 && (
                    <div className="card p-10 text-center text-fg-muted text-sm">
                        No achievements match these filters.
                    </div>
                )}
            </div>

            <ModalOverlay open={Boolean(selected)} onClose={() => setSelected(null)}>
                {selected && (
                    <div
                        className="bg-surface-card w-full sm:max-w-lg max-h-[85dvh] rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-y-auto p-5 sm:p-6 animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <AchievementDetailPanel
                            achievement={selected}
                            onClose={() => setSelected(null)}
                        />
                    </div>
                )}
            </ModalOverlay>
        </>
    );
}
