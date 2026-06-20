import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessClient, requireAuthUser } from "@/lib/apiAuth";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAuthUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;

    const checkIn = await prisma.checkIn.findUnique({
        where: { id },
    });
    if (!checkIn) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isOwner = checkIn.userId === user.id;
    const isCoach = user.role === "COACH" || user.role === "SUPER_ADMIN";

    if (isOwner) {
        await prisma.checkIn.delete({ where: { id } });
        return NextResponse.json({ success: true });
    }

    if (isCoach) {
        if (user.role === "SUPER_ADMIN" || (await canAccessClient(user, checkIn.userId))) {
            await prisma.checkIn.delete({ where: { id } });
            return NextResponse.json({ success: true });
        }
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
