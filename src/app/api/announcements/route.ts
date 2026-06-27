import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import {
    dismissAnnouncement,
    getActiveAnnouncementsForUser,
    getAnnouncementById,
    serializeAnnouncement,
    userMatchesAudience,
    isAnnouncementLive,
} from "@/lib/announcements";

export async function GET(req: Request) {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    const user = authResult.user;
    const url = new URL(req.url);
    const announcementId = url.searchParams.get("id");

    if (announcementId) {
        const announcement = await getAnnouncementById(announcementId);
        if (!announcement) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        if (!userMatchesAudience(user, announcement) || !isAnnouncementLive(announcement)) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json(serializeAnnouncement(announcement));
    }

    const { popup, dashboardBanners } = await getActiveAnnouncementsForUser({
        id: user.id,
        role: user.role,
    });

    return NextResponse.json({
        popup: popup ? serializeAnnouncement(popup) : null,
        dashboardBanners: dashboardBanners.map(serializeAnnouncement),
    });
}

export async function POST(req: Request) {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    try {
        const { announcementId } = await req.json();
        if (!announcementId || typeof announcementId !== "string") {
            return NextResponse.json({ error: "announcementId is required" }, { status: 400 });
        }

        await dismissAnnouncement(authResult.user.id, announcementId);
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "Failed to dismiss announcement" }, { status: 400 });
    }
}
