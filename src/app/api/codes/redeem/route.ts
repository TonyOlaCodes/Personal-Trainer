import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redeemAccessCodeForUser } from "@/lib/accessCodes";
import { z } from "zod";

// POST redeem an access code
export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { code } = z.object({ code: z.string().min(1) }).parse(await req.json());

    const result = await redeemAccessCodeForUser(prisma, user, code);
    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
}
