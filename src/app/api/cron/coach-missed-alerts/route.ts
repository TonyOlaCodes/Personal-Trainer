import { NextResponse } from "next/server";
import { processScheduledCoachAlerts } from "@/lib/coachMissedAlerts";
import { ensureAppSchema } from "@/lib/ensureAppSchema";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorizeCron(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return process.env.NODE_ENV !== "production";

    const authHeader = req.headers.get("authorization");
    return authHeader === `Bearer ${secret}`;
}

/** Every 15 minutes: flush queued coach alerts and run missed scans at each coach's chosen local times. */
export async function GET(req: Request) {
    if (!authorizeCron(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
