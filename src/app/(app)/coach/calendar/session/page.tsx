import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { canAccessClient } from "@/lib/apiAuth";
import { defaultHomeForRole } from "@/lib/roles";
import { loadClientCalendarData } from "@/lib/clientCalendarData";
import { parseLogDate } from "@/lib/utils";
import { resolvePlannedWorkoutWithExercisesForDate } from "@/lib/plannedWorkoutResolve";
import { serializePlanWeeksForSchedule } from "@/lib/planScheduleHistory";
import { getSessionOverride } from "@/lib/workoutSessionOverrides";
import { CoachSessionEditClient } from "./CoachSessionEditClient";
import { pickDisplayName, getNickname } from "@/lib/userNicknames";

export const metadata = { title: "Edit Session" };

export default async function CoachSessionEditPage({
    searchParams,
}: {
    searchParams: Promise<{ clientId?: string; date?: string; workoutId?: string }>;
}) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const { clientId, date: dateKey, workoutId } = await searchParams;
    if (!clientId || !dateKey || !workoutId) {
        redirect("/coach/calendar");
    }

    const actor = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!actor || !["COACH", "SUPER_ADMIN"].includes(actor.role)) {
        redirect(defaultHomeForRole(actor?.role ?? "FREE"));
    }
    if (!(await canAccessClient(actor, clientId))) {
        redirect("/coach/calendar");
    }

    const client = await prisma.user.findUnique({
        where: { id: clientId },
        select: { id: true, name: true, email: true },
    });
    if (!client) notFound();

    const calendar = await loadClientCalendarData(clientId);
    if (!calendar.activePlan || !calendar.planStartedAt) {
        redirect(`/coach/calendar?clientId=${encodeURIComponent(clientId)}&date=${encodeURIComponent(dateKey)}`);
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
        redirect(`/coach/calendar?clientId=${encodeURIComponent(clientId)}&date=${encodeURIComponent(dateKey)}`);
    }

    const override = await getSessionOverride(clientId, dateKey, workoutId);
    const nickname = await getNickname(actor.id, clientId);
    const clientName = pickDisplayName(client.name, client.email, nickname, client.name || "Client");

    const initialExercises = (override?.exercises ?? planned.exercises).map((ex, index) => ({
        id: ex.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        order: index,
        weightTargetKg: ex.weightTargetKg ?? null,
        notes: "notes" in ex ? (ex as { notes?: string | null }).notes ?? null : null,
    }));

    return (
        <>
            <TopBar
                title="Edit Session"
                subtitle={`${clientName} · ${dateKey}`}
                hideSearch
            />
            <div className="p-4 sm:p-6 max-w-2xl mx-auto pb-24">
                <CoachSessionEditClient
                    clientId={clientId}
                    clientName={clientName}
                    dateKey={dateKey}
                    baseWorkoutId={workoutId}
                    planId={calendar.activePlan.id}
                    workoutName={override?.workoutName ?? planned.name}
                    notes={override?.notes ?? ""}
                    initialExercises={initialExercises}
                    hasOverride={Boolean(override)}
                />
            </div>
        </>
    );
}
