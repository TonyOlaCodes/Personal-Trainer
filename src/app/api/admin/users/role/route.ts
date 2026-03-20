import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
    userId: z.string(),
    role: z.enum(["FREE", "PREMIUM", "COACH", "SUPER_ADMIN"]),
});

export async function PATCH(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actor = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!actor || actor.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { userId: targetId, role } = parsed.data;

    await prisma.user.update({
        where: { id: targetId },
        data: { role: role as never },
    });

    return NextResponse.json({ success: true });
}
