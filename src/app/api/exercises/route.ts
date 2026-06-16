import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const exercises = await prisma.globalExercise.findMany({
            select: { name: true, muscleGroup: true },
            orderBy: { name: "asc" }
        });
        return NextResponse.json(exercises);
    } catch (error) {
        console.error("[Exercises GET] Failed to fetch:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
