"use client";

import { Megaphone, ChevronRight } from "lucide-react";
import type { AnnouncementView } from "@/components/shared/AnnouncementModal";

interface Props {
    banners: AnnouncementView[];
    onOpen: (announcement: AnnouncementView) => void;
}

export function AnnouncementDashboardBanners({ banners, onOpen }: Props) {
    if (banners.length === 0) return null;

    return (
        <div className="space-y-3">
            {banners.map((banner) => (
                <button
                    key={banner.id}
                    type="button"
                    onClick={() => onOpen(banner)}
                    className="w-full text-left card-hover p-4 bg-gradient-to-r from-brand-600/15 to-brand-950/40 border-brand-500/30 border shadow-glow-brand animate-slide-up"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center shrink-0">
                            <Megaphone className="w-5 h-5 text-brand-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">
                                Message from {banner.adminName}
                            </p>
                            <h4 className="font-bold text-fg truncate">{banner.title}</h4>
                            <p className="text-sm text-fg-muted truncate">{banner.body}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-brand-400 shrink-0" />
                    </div>
                </button>
            ))}
        </div>
    );
}
