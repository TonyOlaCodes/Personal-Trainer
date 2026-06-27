"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnnouncementModal, type AnnouncementView } from "@/components/shared/AnnouncementModal";

function GlobalAnnouncementsInner() {
    const searchParams = useSearchParams();
    const [popup, setPopup] = useState<AnnouncementView | null>(null);
    const [deepLinkAnnouncement, setDeepLinkAnnouncement] = useState<AnnouncementView | null>(null);
    const [dismissing, setDismissing] = useState(false);

    const loadAnnouncements = useCallback(async () => {
        try {
            const res = await fetch("/api/announcements");
            if (!res.ok) return;
            const data = await res.json();
            setPopup(data.popup ?? null);
        } catch {
            // ignore fetch errors
        }
    }, []);

    useEffect(() => {
        loadAnnouncements();
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") loadAnnouncements();
        }, 60000);
        return () => clearInterval(interval);
    }, [loadAnnouncements]);

    useEffect(() => {
        const announcementId = searchParams.get("announcement");
        if (!announcementId) {
            setDeepLinkAnnouncement(null);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/announcements?id=${encodeURIComponent(announcementId)}`);
                if (!res.ok || cancelled) return;
                const data = await res.json();
                setDeepLinkAnnouncement({
                    id: data.id,
                    title: data.title,
                    body: data.body,
                    adminName: data.adminName,
                });
            } catch {
                // ignore
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [searchParams]);

    const dismissAnnouncement = async (announcementId: string) => {
        setDismissing(true);
        try {
            await fetch("/api/announcements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ announcementId }),
            });
            setPopup(null);
            setDeepLinkAnnouncement(null);
            await loadAnnouncements();

            if (searchParams.get("announcement") && typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.delete("announcement");
                window.history.replaceState({}, "", url.toString());
            }
        } finally {
            setDismissing(false);
        }
    };

    const activeModal = deepLinkAnnouncement ?? popup;

    return activeModal ? (
        <AnnouncementModal
            announcement={activeModal}
            onDismiss={() => dismissAnnouncement(activeModal.id)}
            dismissing={dismissing}
        />
    ) : null;
}

export function GlobalAnnouncements() {
    return (
        <Suspense fallback={null}>
            <GlobalAnnouncementsInner />
        </Suspense>
    );
}
