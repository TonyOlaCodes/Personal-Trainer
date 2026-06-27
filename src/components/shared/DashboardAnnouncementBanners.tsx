"use client";

import { useCallback, useEffect, useState } from "react";
import { AnnouncementDashboardBanners } from "@/components/shared/AnnouncementDashboardBanners";
import type { AnnouncementView } from "@/components/shared/AnnouncementModal";
import { AnnouncementModal } from "@/components/shared/AnnouncementModal";

export function DashboardAnnouncementBanners() {
    const [banners, setBanners] = useState<AnnouncementView[]>([]);
    const [opened, setOpened] = useState<AnnouncementView | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/announcements");
            if (!res.ok) return;
            const data = await res.json();
            setBanners(data.dashboardBanners ?? []);
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    if (banners.length === 0 && !opened) return null;

    return (
        <>
            {banners.length > 0 && (
                <AnnouncementDashboardBanners banners={banners} onOpen={setOpened} />
            )}
            {opened && (
                <AnnouncementModal
                    announcement={opened}
                    onDismiss={() => setOpened(null)}
                    dismissLabel="Close"
                />
            )}
        </>
    );
}
