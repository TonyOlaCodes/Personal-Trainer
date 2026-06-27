import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    MAX_PINNED_EXERCISES,
    normalizePinnedExercises,
    updateUserPinnedExercises,
} from "@/lib/pinnedExercises";

const bodySchema = z.object({
    pinnedExercises: z.array(z.string().min(1)).max(MAX_PINNED_EXERCISES),
    userId: z.string().optional(),
});

export async function PATCH(req: Request) {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const actor = await prisma.user.findUnique({
            where: { clerkId },
            select: { id: true, role: true },
        });
        if (!actor) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const body = await req.json();
        const parsed = bodySchema.parse(body);
        const normalized = normalizePinnedExercises(parsed.pinnedExercises);

        let targetUserId = actor.id;
        if (parsed.userId && parsed.userId !== actor.id) {
            if (!["COACH", "SUPER_ADMIN"].includes(actor.role)) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }

            const client = await prisma.user.findUnique({
                where: { id: parsed.userId },
                select: { id: true, coachId: true },
            });
            if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
            if (actor.role === "COACH" && client.coachId !== actor.id) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            targetUserId = client.id;
        }

        const updated = await updateUserPinnedExercises(targetUserId, normalized);
        return NextResponse.json({ pinnedExercises: updated.pinnedExercises });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.flatten() }, { status: 400 });
        }
        console.error("[PATCH /api/user/pinned-exercises]", error);
        return NextResponse.json({ error: "Failed to save pinned exercises" }, { status: 500 });
    }
}
