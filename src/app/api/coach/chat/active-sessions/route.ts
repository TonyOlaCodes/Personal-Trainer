import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { getActiveSessionsForClients, getCoachClientIds } from "@/lib/coachChat";
import { isCoachRole } from "@/lib/roles";

export async function GET() {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    const user = authResult.user;
    if (!isCoachRole(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clientIds = await getCoachClientIds(user.id, user.role);
    const activeSessions = await getActiveSessionsForClients(clientIds);

    return NextResponse.json({ activeSessions });
}
