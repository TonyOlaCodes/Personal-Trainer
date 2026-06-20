import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { updateUserCheckInSchedule } from "@/lib/checkInSchedule";
import { requireCoachCanEditClient } from "@/lib/apiAuth";

const schema = z.object({
    clientId: z.string().min(1),
    day: z.number().int().min(0).max(6),
    frequencyWeeks: z.number().int().min(1).max(4),
});

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const coach = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const editCheck = await requireCoachCanEditClient(coach, parsed.data.clientId);
    if (editCheck.error) return editCheck.error;

    const client = await prisma.user.findUnique({ where: { id: parsed.data.clientId } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    const schedule = await updateUserCheckInSchedule(client.id, parsed.data.day, parsed.data.frequencyWeeks);
    return NextResponse.json(schedule);
}
