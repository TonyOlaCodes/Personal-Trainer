import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { AdminExercisesClient } from "./AdminExercisesClient";

export const metadata = { title: "Admin - Exercises" };

export default async function AdminExercisesPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user || user.role !== "SUPER_ADMIN") redirect("/dashboard");

    // 1. Get all globally defined exercises
    const globalExercises = await prisma.globalExercise.findMany({
        orderBy: { name: "asc" }
    });

    // 2. Get all unique names from existing plans/workouts to suggest adding videos for them
    const workoutExercises = await prisma.exercise.findMany({
        select: { name: true, muscleGroup: true }
    });

    // Create a map of existing global names for quick lookup
    const globalNames = new Set(globalExercises.map(e => e.name.toLowerCase()));
    
    // Add unique missing names from workouts to global list (locally for display)
    const uniqueFromWorkouts: any[] = [];
    const seenNames = new Set();

    for (const ex of workoutExercises) {
        const lowerName = ex.name.toLowerCase();
        if (!globalNames.has(lowerName) && !seenNames.has(lowerName)) {
            uniqueFromWorkouts.push({
                id: `suggestion-${Math.random().toString(36).substr(2, 9)}`,
                name: ex.name,
                videoUrl: null,
                muscleGroup: ex.muscleGroup || "Uncategorized",
                isSuggestion: true
            });
            seenNames.add(lowerName);
        }
    }

    const allExercises = [...globalExercises, ...uniqueFromWorkouts].sort((a, b) => 
        a.name.localeCompare(b.name)
    );

    return (
        <>
            <TopBar title="Global Exercises" subtitle="Manage video tutorials and dictionary" />
            <AdminExercisesClient initialExercises={allExercises} />
        </>
    );
}
