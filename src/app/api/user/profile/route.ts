import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const profileSchema = z.object({
    name: z.string().min(1).max(50).optional(),
    avatarUrl: z.string().url().optional().or(z.literal("")),
});

export async function PATCH(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { name, avatarUrl } = profileSchema.parse(body);

        const updated = await prisma.user.update({
            where: { clerkId: userId },
            data: {
                name: name !== undefined ? name : undefined,
                avatarUrl: avatarUrl !== undefined ? (avatarUrl === "" ? null : avatarUrl) : undefined,
            },
        });

        return NextResponse.json(updated);
    } catch (err) {
        console.error(err);
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: (err as any).errors[0].message }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}
