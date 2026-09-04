import { NextResponse } from "next/server";
import { authorizeCronRequest, cronUnauthorized } from "@/lib/apiAuth";
import { processDueAnnouncementNotifications } from "@/lib/announcements";
import { ensureAppSchema } from "@/lib/ensureAppSchema";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
    if (!authorizeCronRequest(req)) {
        return cronUnauthorized();
    }

    try {
        await ensureAppSchema();
        const sent = await processDueAnnouncementNotifications();
        return NextResponse.json({ ok: true, sent });
    } catch (error) {
        console.error("[cron/announcements]", error);
        return NextResponse.json({ error: "Cron failed" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    return GET(req);
}
