"use client";

import { Loader2, X } from "lucide-react";
import { ModalOverlay } from "@/components/shared/ModalOverlay";
import { AchievementsList } from "@/components/shared/AchievementsPanel";
import type { AchievementDisplayItem } from "@/lib/achievements";

interface Props {
    open: boolean;
    onClose: () => void;
    achievements: AchievementDisplayItem[];
    totalUnlocked: number;
    totalAchievements: number;
    profileName?: string;
    loading?: boolean;
}

export function AchievementsModal({
    open,
    onClose,
    achievements,
    totalUnlocked,
    totalAchievements,
    profileName,
    loading = false,
}: Props) {
    return (
        <ModalOverlay open={open} onClose={onClose} className="pb-20 md:pb-4">
            <div
                className="bg-surface-card w-full sm:max-w-lg max-h-[min(85dvh,calc(100dvh-5.5rem))] sm:max-h-[85vh] rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-border shrink-0">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Achievements</p>
                        <h3 className="text-lg font-black text-fg truncate">
                            {profileName ? `${profileName}'s milestones` : "All achievements"}
                        </h3>
                        <p className="text-xs text-fg-muted mt-0.5">
                            {totalUnlocked} / {totalAchievements} unlocked
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="btn-icon shrink-0" aria-label="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 min-h-0">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="w-7 h-7 animate-spin text-brand-400" />
                        </div>
                    ) : (
                        <AchievementsList achievements={achievements} />
                    )}
                </div>
            </div>
        </ModalOverlay>
    );
}
