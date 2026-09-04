import { prisma } from "@/lib/prisma";
import { ensureMuscleTargetsColumn } from "@/lib/exerciseMuscleTargets";

let trackingSchemaReady = false;

async function addColumn(sql: string) {
    await prisma.$executeRawUnsafe(sql);
}

/** Idempotent columns for dictionary tracking + extended log/plan metrics. */
export async function ensureExerciseTrackingSchema() {
    if (trackingSchemaReady) return;

    await addColumn(`ALTER TABLE "global_exercises" ADD COLUMN IF NOT EXISTS "trackingPreset" TEXT`);
    await addColumn(`ALTER TABLE "global_exercises" ADD COLUMN IF NOT EXISTS "trackingFields" TEXT`);
    await ensureMuscleTargetsColumn();

    await addColumn(`ALTER TABLE "log_sets" ADD COLUMN IF NOT EXISTS "durationSec" DOUBLE PRECISION`);
    await addColumn(`ALTER TABLE "log_sets" ADD COLUMN IF NOT EXISTS "distanceMeters" DOUBLE PRECISION`);
    await addColumn(`ALTER TABLE "log_sets" ADD COLUMN IF NOT EXISTS "heightCm" DOUBLE PRECISION`);
    await addColumn(`ALTER TABLE "log_sets" ADD COLUMN IF NOT EXISTS "resistance" DOUBLE PRECISION`);
    await addColumn(`ALTER TABLE "log_sets" ADD COLUMN IF NOT EXISTS "inclinePct" DOUBLE PRECISION`);
    await addColumn(`ALTER TABLE "log_sets" ADD COLUMN IF NOT EXISTS "calories" DOUBLE PRECISION`);
    await addColumn(`ALTER TABLE "log_sets" ADD COLUMN IF NOT EXISTS "heartRate" INTEGER`);
    await addColumn(`ALTER TABLE "log_sets" ADD COLUMN IF NOT EXISTS "speedKph" DOUBLE PRECISION`);
    await addColumn(`ALTER TABLE "log_sets" ADD COLUMN IF NOT EXISTS "rir" DOUBLE PRECISION`);

    await addColumn(`ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "targetDurationSec" DOUBLE PRECISION`);
    await addColumn(`ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "targetDistanceMeters" DOUBLE PRECISION`);
    await addColumn(`ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "targetHeightCm" DOUBLE PRECISION`);
    await addColumn(`ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "targetRpe" DOUBLE PRECISION`);
    await addColumn(`ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "targetResistance" DOUBLE PRECISION`);
    await addColumn(`ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "targetInclinePct" DOUBLE PRECISION`);

    trackingSchemaReady = true;
}
