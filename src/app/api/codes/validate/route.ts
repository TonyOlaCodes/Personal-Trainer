import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/apiAuth";
import { enforceRateLimit } from "@/lib/rateLimit";
import { validateAccessCode } from "@/lib/accessCodes";
import { z } from "zod";

export async function POST(req: Request) {
    const authResult = await requireActiveUser(req);
    if (authResult.error) return authResult.error;
    const limited = await enforceRateLimit(req, "codeValidate", authResult.user.id);
    if (limited) return limited;

    const { code } = z.object({ code: z.string().min(1) }).parse(await req.json());
    const result = await validateAccessCode(prisma, code);

    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
        success: true,
        upgradesTo: result.accessCode.upgradesTo,
        planAssigned: !!result.accessCode.planId,
        coachName: result.accessCode.upgradesTo === "GENERAL_PREMIUM"
            ? null
            : result.accessCode.generator.name || result.accessCode.generator.email || "your coach",
        membershipLabel: result.accessCode.upgradesTo === "GENERAL_PREMIUM"
            ? "Premium"
            : result.accessCode.upgradesTo === "PREMIUM"
                ? "Coached Premium"
                : result.accessCode.upgradesTo,
    });
}
