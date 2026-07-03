import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMaintenanceMode, setMaintenanceMode } from "@/lib/maintenanceMode";

const updateSchema = z.object({
    enabled: z.boolean(),
});

async function requireAdmin() {
    const { userId } = await auth();
    if (!userId) return null;

    const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { role: true },
    });

    return user?.role === "SUPER_ADMIN" ? user : null;
}

export async function GET() {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json({ enabled: await getMaintenanceMode() });
}

export async function PATCH(req: Request) {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = updateSchema.parse(await req.json());
    const enabled = await setMaintenanceMode(parsed.enabled);

    return NextResponse.json({ enabled });
}

