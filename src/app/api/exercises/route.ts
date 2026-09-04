import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureExerciseDictionary, searchDictionary } from "@/lib/exerciseDictionary";
import { EXERCISE_SEARCH_LIMIT } from "@/lib/exerciseSearch";
import { ensureExerciseTrackingSchema } from "@/lib/exerciseTracking/ensure";
import { parseTrackingSchemaFromDb } from "@/lib/exerciseTracking/schema";
import { guessTrackingSchema } from "@/lib/exerciseTracking/guess";

export async function GET(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        await ensureExerciseDictionary();
        await ensureExerciseTrackingSchema();

        const url = new URL(req.url);
        const q = url.searchParams.get("q")?.trim() ?? "";
        const limitParam = parseInt(url.searchParams.get("limit") ?? String(EXERCISE_SEARCH_LIMIT), 10);
        const limit = Number.isFinite(limitParam)
            ? Math.min(20, Math.max(1, limitParam))
            : EXERCISE_SEARCH_LIMIT;

        const exercises = await prisma.$queryRaw<
            Array<{
                name: string;
                muscleGroup: string | null;
                trackingPreset: string | null;
                trackingFields: string | null;
            }>
        >`
            SELECT "name", "muscleGroup", "trackingPreset", "trackingFields"
            FROM "global_exercises"
            ORDER BY "name" ASC
        `;

        const mapped = exercises.map((exercise) => {
            const trackingSchema =
                exercise.trackingPreset || exercise.trackingFields
                    ? parseTrackingSchemaFromDb(exercise)
                    : guessTrackingSchema(exercise.name, exercise.muscleGroup);
            return {
                name: exercise.name,
                muscleGroup: exercise.muscleGroup,
                trackingPreset: trackingSchema.preset,
                trackingSchema,
            };
        });

        if (!q) {
            return NextResponse.json(mapped.slice(0, limit));
        }

        return NextResponse.json(
            searchDictionary(
                q,
                mapped.map((exercise) => ({
                    name: exercise.name,
                    muscleGroup: exercise.muscleGroup ?? "",
                })),
                limit
            ).map((hit) => {
                const full = mapped.find((e) => e.name.toLowerCase() === hit.name.toLowerCase());
                return full ?? { ...hit, trackingPreset: "strength", trackingSchema: guessTrackingSchema(hit.name, hit.muscleGroup) };
            })
        );
    } catch (error) {
        console.error("[Exercises GET] Failed to fetch:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
