import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWorkoutLogReadUserId } from "@/lib/apiAuth";
import { getExerciseMediaByNames } from "@/lib/exerciseMedia";
import { loadWorkoutHistorySessions } from "@/lib/workoutHistory";
import {
    buildExerciseRecords,
    findPreviousSessionPerformance,
} from "@/lib/exercisePrs";
import { exerciseIdentityKey } from "@/lib/exerciseIdentity";
import { canonicalExerciseName } from "@/lib/exerciseCanonical";

/**
 * Previous-session sets + all-time records for one exercise name.
 * Used when swapping/adding mid-workout so placeholders and "Last session"
 * appear without leaving and re-entering the log screen.
 */
export async function GET(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actor = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!actor) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const url = new URL(req.url);
    const rawName = url.searchParams.get("name")?.trim() ?? "";
    if (!rawName) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const clientId = url.searchParams.get("clientId");
    const excludeLogId = url.searchParams.get("excludeLogId") || undefined;

    const readTarget = await resolveWorkoutLogReadUserId(actor, clientId);
    if (readTarget.error) return readTarget.error;

    const name = canonicalExerciseName(rawName) || rawName;
    const key = exerciseIdentityKey(name);
    if (!key) {
        return NextResponse.json({
            key: "",
            name,
            previousSession: null,
            records: null,
            media: null,
            muscleGroup: null,
        });
    }

    const [history, mediaByName, global] = await Promise.all([
        loadWorkoutHistorySessions(readTarget.targetUserId, { excludeLogId }),
        getExerciseMediaByNames([name]),
        prisma.globalExercise.findFirst({
            where: { name: { equals: name, mode: "insensitive" } },
            select: { muscleGroup: true, name: true },
        }),
    ]);

    const previousSession = findPreviousSessionPerformance(history, name);
    const records = buildExerciseRecords(history, name);
    const media = mediaByName.get(name) ?? mediaByName.get(global?.name ?? "") ?? null;

    return NextResponse.json({
        key,
        name,
        previousSession,
        records,
        media: media
            ? {
                  videoUrl: media.videoUrl,
                  instructions: media.instructions,
                  thumbnailUrl: media.thumbnailUrl,
              }
            : null,
        muscleGroup: global?.muscleGroup ?? null,
    });
}
