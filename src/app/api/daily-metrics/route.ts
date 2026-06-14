import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    getDailyMetricsSummary,
    normalizeCalories,
    normalizeDailyMetricDate,
    normalizeSleepHours,
    normalizeSteps,
    saveDailyMetricsEntry,
} from "@/lib/dailyMetrics";

const saveSchema = z.object({
    date: z.string(),
    calories: z.number().nullable().optional(),
    steps: z.number().nullable().optional(),
    sleepHours: z.number().nullable().optional(),
});

async function getCurrentUser() {
    const { userId } = await auth();
    if (!userId) return null;
    return prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
}

export async function GET(req: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(req.url);
        const date = normalizeDailyMetricDate(url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10));
        const summary = await getDailyMetricsSummary(user.id, date);

        return NextResponse.json(summary);
    } catch (err) {
        console.error("[DailyMetrics] Failed to load:", err);
        return NextResponse.json({ error: "Could not load daily metrics" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const parsed = saveSchema.parse(await req.json());
        const date = normalizeDailyMetricDate(parsed.date);
        const summary = await saveDailyMetricsEntry(user.id, date, {
            calories: normalizeCalories(parsed.calories),
            steps: normalizeSteps(parsed.steps),
            sleepHours: normalizeSleepHours(parsed.sleepHours),
        });

        return NextResponse.json(summary);
    } catch (err) {
        console.error("[DailyMetrics] Failed to save:", err);
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid daily metrics" }, { status: 400 });
        }
        return NextResponse.json({ error: "Could not save daily metrics" }, { status: 500 });
    }
}
