import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/apiAuth";
import { enforceRateLimit } from "@/lib/rateLimit";
import { redeemAccessCodeForUser } from "@/lib/accessCodes";
import { isCoachRole } from "@/lib/roles";
import { z } from "zod";

// POST redeem an access code
export async function POST(req: Request) {
    const authResult = await requireActiveUser(req);
    if (authResult.error) return authResult.error;
    const user = authResult.user;
    const limited = await enforceRateLimit(req, "codeRedeem", user.id);
    if (limited) return limited;

    if (isCoachRole(user.role)) {
        return NextResponse.json(
            { error: "Coach accounts cannot redeem client access codes." },
            { status: 403 }
        );
    }

    const { code } = z.object({ code: z.string().min(1) }).parse(await req.json());

    const result = await redeemAccessCodeForUser(prisma, user, code);
    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
}
