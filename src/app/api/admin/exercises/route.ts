import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/apiAuth";
import { updateGlobalExerciseMedia } from "@/lib/exerciseMedia";
import { mergeExercisesIntoTarget, syncExerciseRename } from "@/lib/mergeExercises";
import {
    TRACKING_PRESETS,
    type ExerciseTrackingSchema,
    type TrackingPreset,
} from "@/lib/exerciseTracking/types";
import {
    ensureExerciseTrackingSchema,
    normalizeTrackingSchema,
    parseTrackingSchemaFromDb,
    saveTrackingSchema,
} from "@/lib/exerciseTracking";
import {
    ensureMuscleTargetsColumn,
    normalizeMuscleTargets,
    parseMuscleTargetsJson,
    saveMuscleTargets,
    type MuscleTargetEntry,
} from "@/lib/exerciseMuscleTargets";
import { z } from "zod";

const optionalUrl = z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().url("Enter a valid URL").nullable().optional()
);

const trackingPresetEnum = z.enum(
    TRACKING_PRESETS as unknown as [TrackingPreset, ...TrackingPreset[]]
);

const muscleTargetSchema = z.object({
    region: z.string(),
    level: z.enum(["primary", "secondary", "minor"]),
});

const exerciseSchema = z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1),
    muscleGroup: z.string().trim().nullable().optional(),
    videoUrl: optionalUrl,
    instructions: z.string().trim().nullable().optional(),
    thumbnailUrl: optionalUrl,
    trackingPreset: trackingPresetEnum.optional().nullable(),
    trackingFields: z
        .array(
            z.object({
                key: z.string(),
                enabled: z.boolean(),
                required: z.boolean().optional(),
                planTarget: z.boolean().optional(),
                usedForPr: z.boolean().optional(),
                usedForProgress: z.boolean().optional(),
            })
        )
        .optional()
        .nullable(),
    muscleTargets: z.array(muscleTargetSchema).optional().nullable(),
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

function schemaFromPayload(data: {
    trackingPreset?: TrackingPreset | null;
    trackingFields?: Array<{
        key: string;
        enabled: boolean;
        required?: boolean;
        planTarget?: boolean;
        usedForPr?: boolean;
        usedForProgress?: boolean;
    }> | null;
}): ExerciseTrackingSchema {
    return normalizeTrackingSchema({
        preset: data.trackingPreset ?? undefined,
        fields: (data.trackingFields ?? undefined) as ExerciseTrackingSchema["fields"] | undefined,
    });
}

function withTrackingResponse(
    exercise: {
        id: string;
        name: string;
        videoUrl: string | null;
        instructions: string | null;
        thumbnailUrl: string | null;
        muscleGroup: string | null;
        trackingPreset?: string | null;
        trackingFields?: string | null;
        muscleTargets?: string | null;
        createdAt?: Date;
    },
    schema: ExerciseTrackingSchema,
    muscleTargets: MuscleTargetEntry[] = []
) {
    return {
        ...exercise,
        trackingPreset: schema.preset,
        trackingFields: schema.fields,
        trackingSchema: schema,
        muscleTargets,
    };
}

export async function POST(req: Request) {
    const authz = await requireSuperAdmin(req);
    if (authz.error) return authz.error;

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
            await ensureExerciseTrackingSchema();
            const target = await prisma.globalExercise.findFirst({
                where: { name: { equals: result.targetName, mode: "insensitive" } },
            });
            if (!target) {
                return NextResponse.json({ ...result, exercise: target });
            }
            const schema = parseTrackingSchemaFromDb(target);
            const muscleTargets = parseMuscleTargetsJson(
                (target as { muscleTargets?: string | null }).muscleTargets
            );
            return NextResponse.json({
                ...result,
                exercise: withTrackingResponse(target, schema, muscleTargets),
            });
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
    const {
        name,
        muscleGroup,
        videoUrl,
        instructions,
        thumbnailUrl,
        trackingPreset,
        trackingFields,
        muscleTargets: muscleTargetsRaw,
    } = parsed.data;

    try {
        await ensureExerciseTrackingSchema();
        await ensureMuscleTargetsColumn();
        const schema = schemaFromPayload({ trackingPreset, trackingFields });
        const muscleTargets = normalizeMuscleTargets(muscleTargetsRaw ?? []);

        const exercise = await prisma.globalExercise.create({
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
        await saveTrackingSchema(exercise.id, schema);
        await saveMuscleTargets(exercise.id, muscleTargets);

        const refreshed = await prisma.globalExercise.findUnique({ where: { id: exercise.id } });
        return NextResponse.json(
            withTrackingResponse(refreshed ?? exercise, schema, muscleTargets),
            { status: 201 }
        );
    } catch (error) {
        console.error("[Admin Exercises] Create failed:", error);
        return NextResponse.json({ error: "Already exists" }, { status: 400 });
    }
}

export async function PATCH(req: Request) {
    const authz = await requireSuperAdmin(req);
    if (authz.error) return authz.error;

    const parsed = exerciseSchema.extend({ id: z.string().min(1) }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { id, name, muscleGroup, videoUrl, instructions, thumbnailUrl, trackingPreset, trackingFields, muscleTargets: muscleTargetsRaw } =
        parsed.data;

    try {
        await ensureExerciseTrackingSchema();
        await ensureMuscleTargetsColumn();
        const existing = await prisma.globalExercise.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const schema = schemaFromPayload({ trackingPreset, trackingFields });
        const muscleTargets = normalizeMuscleTargets(muscleTargetsRaw ?? []);

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
        await saveTrackingSchema(exercise.id, schema);
        await saveMuscleTargets(exercise.id, muscleTargets);

        // Keep plan exercises + logged history names aligned with the dictionary rename.
        await syncExerciseRename({
            fromName: existing.name,
            toName: name,
            muscleGroup: cleanText(muscleGroup),
        });

        const refreshed = await prisma.globalExercise.findUnique({ where: { id: exercise.id } });
        return NextResponse.json(withTrackingResponse(refreshed ?? exercise, schema, muscleTargets));
    } catch (error) {
        console.error("[Admin Exercises] Update failed:", error);
        return NextResponse.json({ error: "Could not update exercise" }, { status: 400 });
    }
}
