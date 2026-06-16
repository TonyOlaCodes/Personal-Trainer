import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateGlobalExerciseMedia } from "@/lib/exerciseMedia";
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

function cleanText(value?: string | null) {
    return value && value.trim() ? value.trim() : null;
}

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user || user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = exerciseSchema.safeParse(await req.json());
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
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user || user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = exerciseSchema.extend({ id: z.string().min(1) }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { id, name, muscleGroup, videoUrl, instructions, thumbnailUrl } = parsed.data;

    try {
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
        return NextResponse.json(exercise);
    } catch (error) {
        console.error("[Admin Exercises] Update failed:", error);
        return NextResponse.json({ error: "Could not update exercise" }, { status: 400 });
    }
}
