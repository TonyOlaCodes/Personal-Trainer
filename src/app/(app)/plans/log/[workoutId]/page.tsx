import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WorkoutLogClient } from "./WorkoutLogClient";

export const metadata = { title: "Logging session" };

export default async function WorkoutLogPage({
    params,
    searchParams,
}: {
    params: Promise<{ workoutId: string }>;
    searchParams: Promise<{ date?: string }>;
}) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const { workoutId } = await params;
    const { date } = await searchParams;

    const workout = await prisma.workout.findUnique({
        where: { id: workoutId },
        include: { exercises: { orderBy: { order: "asc" } } },
    });

    if (!workout) notFound();

    const globalEx = await prisma.globalExercise.findMany({ where: { videoUrl: { not: null } } });
    const tutorialUrls = globalEx.reduce((acc: any, ex: any) => {
        acc[ex.name] = ex.videoUrl;
        return acc;
    }, {} as Record<string, string>);

    return (
        <div className="bg-surface min-h-screen">
            <WorkoutLogClient
                workout={{
                    id: workout.id,
                    name: workout.name,
                    exercises: workout.exercises.map((ex: any) => ({
                        id: ex.id,
                        name: ex.name,
                        sets: ex.sets,
                        reps: ex.reps,
                        weightTargetKg: ex.weightTargetKg,
                        notes: ex.notes,
                    })),
                }}
                tutorialUrls={tutorialUrls}
                logDate={date}
            />
        </div>
    );
}
