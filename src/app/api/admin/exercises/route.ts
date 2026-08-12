import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateGlobalExerciseMedia } from "@/lib/exerciseMedia";
import { mergeExercisesIntoTarget, syncExerciseRename } from "@/lib/mergeExercises";
import { z } from "zod";

const optionalUrl = z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().url("Enter a valid URL").nullable().optional()
);

const exerciseSchema = z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1),
    muscleGroup: z.string().trim().nullable().optional(),
    videoUrl: optionalUrl,
    instructions: z.string().trim().nullable().optional(),
    thumbnailUrl: optionalUrl,
});

const mergeSchema = z.object({
    action: z.literal("merge"),
    sourceIds: z.array(z.string().min(1)).min(1),
    targetName: z.string().trim().min(1),
    targetMuscleGroup: z.string().trim().nullable().optional(),
    keepId: z.string().min(1).optional(),
});

function cleanText(value?: string | null) {
    return value && value.trim() ? value.trim() : null;
}

async function requireAdmin() {
    const { userId } = await auth();
    if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user || user.role !== "SUPER_ADMIN") {
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { user };
}

export async function POST(req: Request) {
    const authz = await requireAdmin();
    if ("error" in authz) return authz.error;

    const body = await req.json();

    // Combine exercises into one survivor (history from all sources remaps onto the target).
    if (body?.action === "merge") {
        const parsed = mergeSchema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

        const { sourceIds, targetName, targetMuscleGroup, keepId } = parsed.data;
        const sources = await prisma.globalExercise.findMany({
            where: { id: { in: sourceIds } },
            select: { id: true, name: true },
        });
        if (sources.length === 0) {
            return NextResponse.json({ error: "No source exercises found" }, { status: 404 });
        }

        // If keepId is set and not already in sources, include it as a source so media folds in.
        const names = sources.map((s) => s.name);
        if (keepId) {
            const keep = await prisma.globalExercise.findUnique({ where: { id: keepId }, select: { name: true } });
            if (keep && !names.some((n) => n.toLowerCase() === keep.name.toLowerCase())) {
                names.push(keep.name);
            }
        }

        try {
            const result = await prisma.$transaction(async (tx) =>
                mergeExercisesIntoTarget({
                    sourceNames: names,
                    targetName,
                    targetMuscleGroup: targetMuscleGroup ?? undefined,
                    db: tx,
                })
            );
            const target = await prisma.globalExercise.findFirst({
                where: { name: { equals: result.targetName, mode: "insensitive" } },
            });
            return NextResponse.json({ ...result, exercise: target });
        } catch (error) {
            console.error("[Admin Exercises] Merge failed:", error);
            return NextResponse.json(
                { error: error instanceof Error ? error.message : "Merge failed" },
                { status: 400 }
            );
        }
    }

    const parsed = exerciseSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { name, muscleGroup, videoUrl, instructions, thumbnailUrl } = parsed.data;

    try {
        const exercise = await prisma.globalExercise.create({
            data: { name, muscleGroup: cleanText(muscleGroup), videoUrl: videoUrl ?? null }
        });
        await updateGlobalExerciseMedia(exercise.id, {
            instructions: cleanText(instructions),
            thumbnailUrl: thumbnailUrl ?? null,
        });
        return NextResponse.json(exercise, { status: 201 });
    } catch (error) {
        console.error("[Admin Exercises] Create failed:", error);
        return NextResponse.json({ error: "Already exists" }, { status: 400 });
    }
}

export async function PATCH(req: Request) {
    const authz = await requireAdmin();
    if ("error" in authz) return authz.error;

    const parsed = exerciseSchema.extend({ id: z.string().min(1) }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { id, name, muscleGroup, videoUrl, instructions, thumbnailUrl } = parsed.data;

    try {
        const existing = await prisma.globalExercise.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const exercise = await prisma.globalExercise.update({
            where: { id },
            data: {
                name,
                muscleGroup: cleanText(muscleGroup),
                videoUrl: videoUrl ?? null,
            },
        });
        await updateGlobalExerciseMedia(exercise.id, {
            instructions: cleanText(instructions),
            thumbnailUrl: thumbnailUrl ?? null,
        });

        // Keep plan exercises + logged history names aligned with the dictionary rename.
        await syncExerciseRename({
            fromName: existing.name,
            toName: name,
            muscleGroup: cleanText(muscleGroup),
        });

        return NextResponse.json(exercise);
    } catch (error) {
        console.error("[Admin Exercises] Update failed:", error);
        return NextResponse.json({ error: "Could not update exercise" }, { status: 400 });
    }
}
