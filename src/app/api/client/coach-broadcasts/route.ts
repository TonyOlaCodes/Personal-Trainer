import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { isClientRole } from "@/lib/roles";
import {
    acknowledgeCoachBroadcast,
    getPendingCoachBroadcastsForClient,
} from "@/lib/coachBroadcasts";

/** Pending coach broadcasts for the signed-in client (newest first). */
export async function GET() {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    if (!isClientRole(authResult.user.role)) {
        return NextResponse.json({ broadcasts: [] });
    }

    const broadcasts = await getPendingCoachBroadcastsForClient(authResult.user.id);
    return NextResponse.json({
        broadcast: broadcasts[0] ?? null,
        remaining: Math.max(0, broadcasts.length - 1),
    });
}

/** Acknowledge one broadcast for this client only. */
export async function POST(req: Request) {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    if (!isClientRole(authResult.user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const messageId = typeof body?.messageId === "string" ? body.messageId : "";
        if (!messageId) {
            return NextResponse.json({ error: "messageId is required" }, { status: 400 });
        }

        await acknowledgeCoachBroadcast(authResult.user.id, messageId);
        const broadcasts = await getPendingCoachBroadcastsForClient(authResult.user.id);
        return NextResponse.json({
            ok: true,
            broadcast: broadcasts[0] ?? null,
            remaining: Math.max(0, broadcasts.length - 1),
        });
    } catch {
        return NextResponse.json({ error: "Failed to acknowledge broadcast" }, { status: 400 });
    }
}
