import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { touchUserLastActive } from "@/lib/userPresence";

/** Heartbeat for real foreground app activity — not workouts or background polls. */
export async function POST(req: Request) {
    const authResult = await requireAuthUser(req);
    if (authResult.error) return authResult.error;

    await touchUserLastActive(authResult.user.id);
    return NextResponse.json({ ok: true });
}
