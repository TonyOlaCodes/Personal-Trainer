import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureExerciseDictionary, searchDictionary } from "@/lib/exerciseDictionary";

export async function GET(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        await ensureExerciseDictionary();

        const url = new URL(req.url);
        const q = url.searchParams.get("q")?.trim() ?? "";

        const exercises = await prisma.globalExercise.findMany({
            select: { name: true, muscleGroup: true },
            orderBy: { name: "asc" },
        });

        if (!q) {
            return NextResponse.json(exercises);
        }

        return NextResponse.json(searchDictionary(q, exercises, 20));
    } catch (error) {
        console.error("[Exercises GET] Failed to fetch:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
