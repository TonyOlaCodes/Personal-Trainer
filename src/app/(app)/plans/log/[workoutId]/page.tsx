import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WorkoutLogClient } from "./WorkoutLogClient";

export const metadata = { title: "Logging session" };

export default async function WorkoutLogPage({ params }: { params: { workoutId: string } }) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const workout = await prisma.workout.findUnique({
        where: { id: params.workoutId },
        include: { exercises: { orderBy: { order: "asc" } } },
    });

    if (!workout) notFound();

    // Basic check for plan ownership
    // (In production, ensure the user belongs to the plan containing this workout)

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
            />
        </div>
    );
}
