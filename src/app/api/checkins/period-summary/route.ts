import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/apiAuth";
import { getCheckInPeriodSummary } from "@/lib/checkInPeriodSummary";
import { getUserCheckInSchedule } from "@/lib/checkInSchedule";
import { toDateKey } from "@/lib/utils";

export async function GET(req: Request) {
    try {
        const authResult = await requireActiveUser(req);
        if (authResult.error) return authResult.error;
        const actor = authResult.user;

        const url = new URL(req.url);
        const date = url.searchParams.get("date") ?? toDateKey(new Date());
        const periodDueDateKey = url.searchParams.get("periodDueDate") ?? url.searchParams.get("periodDueDateKey");
        const clientId = url.searchParams.get("clientId");

        let targetUserId = actor.id;
        let hiddenGoals = actor.hiddenGoals ?? [];

        if (clientId && clientId !== actor.id) {
            if (!["COACH", "SUPER_ADMIN"].includes(actor.role)) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            const client = await prisma.user.findUnique({
                where: { id: clientId },
                select: { id: true, coachId: true, hiddenGoals: true },
            });
            if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
            if (actor.role === "COACH" && client.coachId !== actor.id) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            targetUserId = client.id;
            hiddenGoals = client.hiddenGoals ?? [];
        }

        const schedule = await getUserCheckInSchedule(targetUserId);
        const summary = await getCheckInPeriodSummary(targetUserId, periodDueDateKey ?? date, {
            schedule,
            hiddenGoals,
            periodDueDateKey: periodDueDateKey ?? undefined,
        });

        return NextResponse.json(summary);
    } catch (error) {
        console.error("[CheckInPeriodSummary]", error);
        return NextResponse.json({ error: "Could not load period summary" }, { status: 500 });
    }
}
