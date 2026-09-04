import { NextResponse } from "next/server";
import { authorizeCronRequest, cronUnauthorized } from "@/lib/apiAuth";
import { processScheduledCoachAlerts } from "@/lib/coachMissedAlerts";
import { ensureAppSchema } from "@/lib/ensureAppSchema";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron (08:00, 09:00, 10:00 & 18:00 UTC): flush queued coach alerts; notify missed due items from the previous day. */
export async function GET(req: Request) {
    if (!authorizeCronRequest(req)) {
        return cronUnauthorized();
    }

    try {
        await ensureAppSchema();
        const result = await processScheduledCoachAlerts(new Date());
        return NextResponse.json({ ok: true, ...result });
    } catch (error) {
        console.error("[cron/coach-missed-alerts]", error);
        return NextResponse.json({ error: "Cron failed" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    return GET(req);
}
