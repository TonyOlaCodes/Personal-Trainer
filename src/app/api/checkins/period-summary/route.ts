import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCheckInPeriodSummary } from "@/lib/checkInPeriodSummary";
import { getUserCheckInSchedule } from "@/lib/checkInSchedule";

export async function GET(req: Request) {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const actor = await prisma.user.findUnique({ where: { clerkId } });
        if (!actor) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const url = new URL(req.url);
        const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
        const clientId = url.searchParams.get("clientId");
        const fallbackBodyweight = url.searchParams.get("bodyweightKg");

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
        const summary = await getCheckInPeriodSummary(targetUserId, date, {
            schedule,
            hiddenGoals,
            fallbackBodyweightKg: fallbackBodyweight ? Number(fallbackBodyweight) : null,
        });

        return NextResponse.json(summary);
    } catch (error) {
        console.error("[CheckInPeriodSummary]", error);
        return NextResponse.json({ error: "Could not load period summary" }, { status: 500 });
    }
}
