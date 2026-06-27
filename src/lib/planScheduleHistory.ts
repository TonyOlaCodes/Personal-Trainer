import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/appTimezone";
import { getLocalTimeParts } from "@/lib/coachNotificationSchedule";
import { parseLogDate, toDateKey } from "@/lib/utils";
import type { PlanWeekLike, PlanWorkoutLike } from "@/lib/planSchedule";

export type ScheduleWorkoutSnapshot = {
    id: string;
    name: string;
    dayNumber: number;
    dayOfWeek: number | null;
    exercises?: Array<{ name: string; sets: number; reps: string }>;
};

export type ScheduleWeekSnapshot = {
    weekNumber: number;
    workouts: ScheduleWorkoutSnapshot[];
};

export type PlanScheduleRevisionRecord = {
    effectiveFrom: string;
    priorWeeks: ScheduleWeekSnapshot[];
};

type WeekSource = {
    weekNumber: number;
    workouts: Array<{
        id: string;
        name: string;
        dayNumber: number;
        dayOfWeek?: number | null;
        exercises?: Array<{ name: string; sets: number; reps: string }>;
    }>;
};

let revisionsTableReady = false;

export async function ensurePlanScheduleRevisionsTable() {
    if (revisionsTableReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "plan_schedule_revisions" (
            "id" TEXT NOT NULL,
            "planId" TEXT NOT NULL,
            "effectiveFrom" DATE NOT NULL,
            "priorWeeks" JSONB NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "plan_schedule_revisions_pkey" PRIMARY KEY ("id")
        )
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "plan_schedule_revisions_planId_effectiveFrom_idx"
        ON "plan_schedule_revisions" ("planId", "effectiveFrom")
    `;

    revisionsTableReady = true;
}

export function serializePlanWeeksForSchedule(weeks: WeekSource[]): ScheduleWeekSnapshot[] {
    return weeks
        .slice()
        .sort((a, b) => a.weekNumber - b.weekNumber)
        .map((week) => ({
            weekNumber: week.weekNumber,
            workouts: week.workouts
                .slice()
                .sort((a, b) => a.dayNumber - b.dayNumber)
                .map((workout) => ({
                    id: workout.id,
                    name: workout.name,
                    dayNumber: workout.dayNumber,
                    dayOfWeek: workout.dayOfWeek ?? null,
                    exercises: workout.exercises?.map((exercise) => ({
                        name: exercise.name,
                        sets: exercise.sets,
                        reps: exercise.reps,
                    })),
                })),
        }));
}

export function scheduleWeeksStructureEqual(a: ScheduleWeekSnapshot[], b: ScheduleWeekSnapshot[]) {
    return JSON.stringify(a) === JSON.stringify(b);
}

export function resolveScheduleWeeksForDate(
    liveWeeks: PlanWeekLike[],
    revisions: PlanScheduleRevisionRecord[],
    date: Date,
    today: Date
): PlanWeekLike[] {
    const targetKey = toDateKey(date);
    const todayKey = toDateKey(today);

    if (targetKey >= todayKey) {
        return liveWeeks;
    }

    const sorted = [...revisions].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    const nextRevision = sorted.find((revision) => revision.effectiveFrom > targetKey);
    if (nextRevision) {
        return nextRevision.priorWeeks;
    }

    return liveWeeks;
}

export async function loadPlanScheduleRevisions(planId: string): Promise<PlanScheduleRevisionRecord[]> {
    await ensurePlanScheduleRevisionsTable();

    const rows = await prisma.$queryRaw<Array<{ effectiveFrom: Date; priorWeeks: unknown }>>`
        SELECT "effectiveFrom", "priorWeeks"
        FROM "plan_schedule_revisions"
        WHERE "planId" = ${planId}
        ORDER BY "effectiveFrom" ASC
    `;

    return rows.map((row) => ({
        effectiveFrom: toDateKey(row.effectiveFrom),
        priorWeeks: row.priorWeeks as ScheduleWeekSnapshot[],
    }));
}

export async function loadPlanScheduleRevisionsByPlanIds(
    planIds: string[]
): Promise<Record<string, PlanScheduleRevisionRecord[]>> {
    if (planIds.length === 0) return {};

    await ensurePlanScheduleRevisionsTable();

    const rows = await prisma.$queryRaw<Array<{ planId: string; effectiveFrom: Date; priorWeeks: unknown }>>`
        SELECT "planId", "effectiveFrom", "priorWeeks"
        FROM "plan_schedule_revisions"
        WHERE "planId" IN (${Prisma.join(planIds.map((id) => Prisma.sql`${id}`))})
        ORDER BY "effectiveFrom" ASC
    `;

    const grouped: Record<string, PlanScheduleRevisionRecord[]> = {};
    for (const row of rows) {
        if (!grouped[row.planId]) grouped[row.planId] = [];
        grouped[row.planId].push({
            effectiveFrom: toDateKey(row.effectiveFrom),
            priorWeeks: row.priorWeeks as ScheduleWeekSnapshot[],
        });
    }
    return grouped;
}

export async function maybeRecordPlanScheduleRevision(
    tx: Prisma.TransactionClient,
    planId: string,
    priorWeeks: ScheduleWeekSnapshot[],
    newWeeks: ScheduleWeekSnapshot[]
) {
    if (scheduleWeeksStructureEqual(priorWeeks, newWeeks)) return;

    await ensurePlanScheduleRevisionsTable();

    const { dateKey } = getLocalTimeParts(new Date(), APP_TIMEZONE);
    const effectiveFrom = parseLogDate(dateKey);

    const existing = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "plan_schedule_revisions"
        WHERE "planId" = ${planId}
          AND "effectiveFrom" = ${effectiveFrom}::date
        LIMIT 1
    `;
    if (existing.length > 0) return;

    await tx.$executeRaw`
        INSERT INTO "plan_schedule_revisions" ("id", "planId", "effectiveFrom", "priorWeeks")
        VALUES (${randomUUID()}, ${planId}, ${effectiveFrom}::date, ${JSON.stringify(priorWeeks)}::jsonb)
    `;
}
