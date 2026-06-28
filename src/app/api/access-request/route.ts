import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthUser } from "@/lib/apiAuth";
import { getAccessRequestStatus, sendAccessRequest } from "@/lib/accessRequest";

const postSchema = z.object({
    message: z.string().min(1).max(2000),
});

export async function GET() {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    const status = await getAccessRequestStatus(authResult.user.id);
    return NextResponse.json(status);
}

export async function POST(req: Request) {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    try {
        const parsed = postSchema.parse(await req.json());
        const result = await sendAccessRequest(authResult.user.id, parsed.message);

        if ("alreadyAssigned" in result && result.alreadyAssigned) {
            return NextResponse.json({
                ok: true,
                alreadyAssigned: true,
                chatRoute: `/chat?with=${result.liaisonId}`,
            });
        }

        return NextResponse.json({
            ok: true,
            sent: true,
            adminCount: result.adminCount,
            chatRoute: "/chat",
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Could not send access request";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
