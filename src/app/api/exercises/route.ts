import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureExerciseDictionary, searchDictionary } from "@/lib/exerciseDictionary";
import { EXERCISE_SEARCH_LIMIT } from "@/lib/exerciseSearch";

export async function GET(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        await ensureExerciseDictionary();

        const url = new URL(req.url);
        const q = url.searchParams.get("q")?.trim() ?? "";
        const limitParam = parseInt(url.searchParams.get("limit") ?? String(EXERCISE_SEARCH_LIMIT), 10);
        const limit = Number.isFinite(limitParam)
            ? Math.min(20, Math.max(1, limitParam))
            : EXERCISE_SEARCH_LIMIT;

        const exercises = await prisma.globalExercise.findMany({
            select: { name: true, muscleGroup: true },
            orderBy: { name: "asc" },
        });

        if (!q) {
            return NextResponse.json(exercises.slice(0, limit));
        }

        return NextResponse.json(
            searchDictionary(
                q,
                exercises.map((exercise) => ({
                    name: exercise.name,
                    muscleGroup: exercise.muscleGroup ?? "",
                })),
                limit
            )
        );
    } catch (error) {
        console.error("[Exercises GET] Failed to fetch:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
