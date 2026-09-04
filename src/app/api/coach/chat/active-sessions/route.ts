import { NextResponse } from "next/server";
import { requireCoachUser } from "@/lib/apiAuth";
import { getActiveSessionsForClients, getCoachClientIds } from "@/lib/coachChat";

export async function GET() {
    const authResult = await requireCoachUser();
    if (authResult.error) return authResult.error;

    const user = authResult.user;
    const clientIds = await getCoachClientIds(user.id);
    const activeSessions = await getActiveSessionsForClients(clientIds);

    return NextResponse.json({ activeSessions });
}
