import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { createCoachCodeRequest, getCoachCodeRequestStatus } from "@/lib/coachCodeRequest";

export async function GET() {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    const status = await getCoachCodeRequestStatus(authResult.user.id);
    return NextResponse.json(status);
}

export async function POST() {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    try {
        const result = await createCoachCodeRequest(authResult.user.id);
        if ("alreadySent" in result && result.alreadySent) {
            return NextResponse.json({
                ok: true,
                alreadySent: true,
                message: "Request sent. An admin or coach will reach out shortly.",
            });
        }

        return NextResponse.json({
            ok: true,
            sent: true,
            message: "Request sent. An admin or coach will reach out shortly.",
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Could not send request";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
