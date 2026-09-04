import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthUser } from "@/lib/apiAuth";
import {
    consumeAchievementEvent,
    getPendingAchievementEvents,
} from "@/lib/achievements/engine";
import { isCoachRole } from "@/lib/roles";

export async function GET() {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;
    if (isCoachRole(authResult.user.role)) {
        return NextResponse.json({ events: [] });
    }

    const events = await getPendingAchievementEvents(authResult.user.id);
    return NextResponse.json({
        events: events.map((event) => ({
            id: event.id,
            familyKey: event.familyKey,
            name: event.name,
            description: event.description,
            rarity: event.rarity,
            eventType: event.eventType,
            prestigeValue: event.prestigeValue,
            icon: event.icon,
            createdAt: event.createdAt.toISOString(),
        })),
    });
}

const consumeSchema = z.object({
    eventId: z.string().min(1),
});

export async function POST(req: Request) {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;
    if (isCoachRole(authResult.user.role)) {
        return NextResponse.json({ ok: true });
    }

    const body = await req.json().catch(() => null);
    const parsed = consumeSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    const ok = await consumeAchievementEvent(authResult.user.id, parsed.data.eventId);
    return NextResponse.json({ ok });
}
