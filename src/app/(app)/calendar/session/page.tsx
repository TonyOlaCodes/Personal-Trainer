import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { defaultHomeForRole, isCoachRole } from "@/lib/roles";
import { loadClientCalendarData } from "@/lib/clientCalendarData";
import { parseLogDate } from "@/lib/utils";
import { resolvePlannedWorkoutWithExercisesForDate } from "@/lib/plannedWorkoutResolve";
import { serializePlanWeeksForSchedule } from "@/lib/planScheduleHistory";
import {
    buildDefaultSetTargets,
    getSessionOverride,
} from "@/lib/workoutSessionOverrides";
import { SessionEditClient } from "@/components/session/SessionEditClient";

export const metadata = { title: "Edit Session" };

export default async function AthleteSessionEditPage({
    searchParams,
}: {
    searchParams: Promise<{ date?: string; workoutId?: string }>;
}) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const { date: dateKey, workoutId } = await searchParams;
    if (!dateKey || !workoutId) redirect("/calendar");

    const actor = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!actor) redirect("/sign-in");
    if (isCoachRole(actor.role)) {
        redirect(defaultHomeForRole(actor.role));
    }

    const calendar = await loadClientCalendarData(actor.id);
    if (!calendar.activePlan || !calendar.planStartedAt) {
        redirect(`/calendar?date=${encodeURIComponent(dateKey)}`);
    }

    const serializedWeeks = serializePlanWeeksForSchedule(
        calendar.activePlan.weeks.map((week) => ({
            weekNumber: week.weekNumber,
            workouts: week.workouts.map((workout) => ({
                id: workout.id,
                name: workout.name,
                dayNumber: workout.dayNumber,
                dayOfWeek: workout.dayOfWeek ?? null,
                exercises: workout.exercises.map((exercise) => ({
                    id: exercise.id,
                    name: exercise.name,
                    sets: exercise.sets,
                    reps: exercise.reps,
                    weightTargetKg: exercise.weightTargetKg ?? null,
                })),
            })),
        }))
    );

    const planned = resolvePlannedWorkoutWithExercisesForDate({
        startedAt: calendar.planStartedAt,
        weeks: serializedWeeks,
        scheduleRevisions: calendar.scheduleRevisions,
        date: parseLogDate(dateKey),
        dateKey,
    });

    if (!planned || planned.id !== workoutId) {
        redirect(`/calendar?date=${encodeURIComponent(dateKey)}`);
    }

    const override = await getSessionOverride(actor.id, dateKey, workoutId);

    const initialExercises = (override?.exercises ?? planned.exercises).map((ex, index) => {
        const setTargets =
            "setTargets" in ex && Array.isArray(ex.setTargets) && ex.setTargets.length > 0
                ? ex.setTargets
                : buildDefaultSetTargets({
                      sets: ex.sets,
                      reps: ex.reps,
                      weightTargetKg: ex.weightTargetKg ?? null,
                  });
        return {
            id: ex.id,
            name: ex.name,
            sets: setTargets.length,
            reps: ex.reps,
            order: index,
            weightTargetKg: ex.weightTargetKg ?? null,
            notes: "notes" in ex ? (ex as { notes?: string | null }).notes ?? null : null,
            setTargets,
        };
    });

    const backHref = `/calendar?date=${encodeURIComponent(dateKey)}`;

    return (
        <>
            <TopBar title="Edit Session" subtitle={dateKey} hideSearch />
            {/* Width is owned by SessionEditClient so it can widen for the history split. */}
            <div className="p-4 sm:p-6">
                <SessionEditClient
                    dateKey={dateKey}
                    baseWorkoutId={workoutId}
                    planId={calendar.activePlan.id}
                    workoutName={override?.workoutName ?? planned.name}
                    notes={override?.notes ?? ""}
                    initialExercises={initialExercises}
                    hasOverride={Boolean(override)}
                    backHref={backHref}
                />
            </div>
        </>
    );
}
