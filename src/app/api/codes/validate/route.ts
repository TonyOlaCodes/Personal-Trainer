import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateAccessCode } from "@/lib/accessCodes";
import { z } from "zod";

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { code } = z.object({ code: z.string().min(1) }).parse(await req.json());
    const result = await validateAccessCode(prisma, code);

    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
        success: true,
        upgradesTo: result.accessCode.upgradesTo,
        planAssigned: !!result.accessCode.planId,
        coachName: result.accessCode.generator.name || result.accessCode.generator.email || "your coach",
    });
}
