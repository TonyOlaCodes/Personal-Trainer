import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE a check-in
export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const checkIn = await prisma.checkIn.findUnique({
        where: { id: params.id },
    });
    if (!checkIn) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isCoach = ["COACH", "SUPER_ADMIN"].includes(user.role);
    const isOwner = checkIn.userId === user.id;

    if (!isCoach && !isOwner) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.checkIn.delete({
        where: { id: params.id },
    });

    return NextResponse.json({ success: true });
}
