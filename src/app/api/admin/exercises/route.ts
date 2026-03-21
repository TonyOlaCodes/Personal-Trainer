import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user || user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { name, muscleGroup, videoUrl } = await req.json();

    try {
        const exercise = await prisma.globalExercise.create({
            data: { name, muscleGroup, videoUrl }
        });
        return NextResponse.json(exercise, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: "Already exists" }, { status: 400 });
    }
}

export async function PATCH(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user || user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id, videoUrl } = await req.json();

    try {
        const exercise = await prisma.globalExercise.update({
            where: { id },
            data: { videoUrl }
        });
        return NextResponse.json(exercise);
    } catch (error) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
}
