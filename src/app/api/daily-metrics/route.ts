import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveUser } from "@/lib/apiAuth";
import {
    getDailyMetricsSummary,
    normalizeCalories,
    normalizeDailyMetricDate,
    normalizeSleepHours,
    normalizeSteps,
    saveDailyMetricsEntry,
} from "@/lib/dailyMetrics";
import { triggerAchievementSync } from "@/lib/achievements";
import { toDateKey } from "@/lib/utils";

const saveSchema = z.object({
    date: z.string(),
    calories: z.number().nullable().optional(),
    steps: z.number().nullable().optional(),
    sleepHours: z.number().nullable().optional(),
});

export async function GET(req: Request) {
    try {
        const authResult = await requireActiveUser(req);
        if (authResult.error) return authResult.error;
        const user = authResult.user;

        const url = new URL(req.url);
        const date = normalizeDailyMetricDate(url.searchParams.get("date") ?? toDateKey(new Date()));
        const summary = await getDailyMetricsSummary(user.id, date);

        return NextResponse.json(summary);
    } catch (err) {
        console.error("[DailyMetrics] Failed to load:", err);
        return NextResponse.json({ error: "Could not load daily metrics" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const authResult = await requireActiveUser(req);
        if (authResult.error) return authResult.error;
        const user = authResult.user;

        const parsed = saveSchema.parse(await req.json());
        const date = normalizeDailyMetricDate(parsed.date);
        const summary = await saveDailyMetricsEntry(user.id, date, {
            calories: normalizeCalories(parsed.calories),
            steps: normalizeSteps(parsed.steps),
            sleepHours: normalizeSleepHours(parsed.sleepHours),
        });

        triggerAchievementSync(user.id);
        return NextResponse.json(summary);
    } catch (err) {
        console.error("[DailyMetrics] Failed to save:", err);
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid daily metrics" }, { status: 400 });
        }
        return NextResponse.json({ error: "Could not save daily metrics" }, { status: 500 });
    }
}
