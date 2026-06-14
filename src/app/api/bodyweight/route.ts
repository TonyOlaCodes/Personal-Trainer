import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    getBodyweightSummary,
    getBodyweightWeeklyAverage,
    normalizeBodyweight,
    normalizeBodyweightDate,
    saveBodyweightEntry,
} from "@/lib/bodyweight";

const saveSchema = z.object({
    date: z.string(),
    weightKg: z.number(),
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
        const date = normalizeBodyweightDate(url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10));
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
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const parsed = saveSchema.parse(await req.json());
        const date = normalizeBodyweightDate(parsed.date);
        const weightKg = normalizeBodyweight(parsed.weightKg);
        const summary = await saveBodyweightEntry(user.id, date, weightKg);

        return NextResponse.json(summary);
    } catch (err) {
        console.error("[Bodyweight] Failed to save:", err);
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid bodyweight log" }, { status: 400 });
        }
        return NextResponse.json({ error: "Could not save bodyweight log" }, { status: 500 });
    }
}
