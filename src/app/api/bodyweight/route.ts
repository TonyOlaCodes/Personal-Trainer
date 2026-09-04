import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveUser } from "@/lib/apiAuth";
import {
    getBodyweightSummary,
    getBodyweightWeeklyAverage,
    normalizeBodyweight,
    normalizeBodyweightDate,
    saveBodyweightEntry,
} from "@/lib/bodyweight";
import { notifyCoachOfClientBodyweight } from "@/lib/notifications";
import { triggerAchievementSync } from "@/lib/achievements";
import { toDateKey } from "@/lib/utils";

const saveSchema = z.object({
    date: z.string(),
    weightKg: z.number(),
});

export async function GET(req: Request) {
    try {
        const authResult = await requireActiveUser(req);
        if (authResult.error) return authResult.error;
        const user = authResult.user;

        const url = new URL(req.url);
        const date = normalizeBodyweightDate(url.searchParams.get("date") ?? toDateKey(new Date()));
        const [summary, weeklyAverage] = await Promise.all([
            getBodyweightSummary(user.id, date),
            getBodyweightWeeklyAverage(user.id, date),
        ]);

        return NextResponse.json({ ...summary, weeklyAverage });
    } catch (err) {
        console.error("[Bodyweight] Failed to load:", err);
        return NextResponse.json({ error: "Could not load bodyweight log" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const authResult = await requireActiveUser(req);
        if (authResult.error) return authResult.error;
        const user = authResult.user;

        const parsed = saveSchema.parse(await req.json());
        const date = normalizeBodyweightDate(parsed.date);
        const weightKg = normalizeBodyweight(parsed.weightKg);

        const { maybeAutoResumeCoachPausedClient } = await import("@/lib/coachClientPause");
        await maybeAutoResumeCoachPausedClient(user.id);

        const summary = await saveBodyweightEntry(user.id, date, weightKg);

        if (user.coachId) {
            await notifyCoachOfClientBodyweight({
                coachId: user.coachId,
                clientId: user.id,
                clientName: user.name ?? user.email,
                weightKg,
            });
        }

        triggerAchievementSync(user.id);
        return NextResponse.json(summary);
    } catch (err) {
        console.error("[Bodyweight] Failed to save:", err);
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid bodyweight log" }, { status: 400 });
        }
        return NextResponse.json({ error: "Could not save bodyweight log" }, { status: 500 });
    }
}
