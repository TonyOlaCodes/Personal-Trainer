import { NextResponse } from "next/server";
import { z } from "zod";
import { canDirectMessage, requireAuthUser } from "@/lib/apiAuth";
import { isPeerTyping, setChatTyping } from "@/lib/chatTyping";

const typingSchema = z.object({
    withUserId: z.string().min(1),
    typing: z.boolean(),
});

export async function GET(req: Request) {
    const authResult = await requireAuthUser(req);
    if (authResult.error) return authResult.error;

    const user = authResult.user;
    if (user.role === "FREE") {
        return NextResponse.json({ typing: false });
    }

    const withUserId = new URL(req.url).searchParams.get("with");
    if (!withUserId) {
        return NextResponse.json({ error: "with is required" }, { status: 400 });
    }

    if (!(await canDirectMessage(user, withUserId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const typing = await isPeerTyping(user.id, withUserId);
    return NextResponse.json({ typing });
}

export async function POST(req: Request) {
    const authResult = await requireAuthUser(req);
    if (authResult.error) return authResult.error;

    const user = authResult.user;
    if (user.role === "FREE") {
        return NextResponse.json({ error: "Direct chat requires Premium access" }, { status: 403 });
    }

    const parsed = typingSchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { withUserId, typing } = parsed.data;

    if (!(await canDirectMessage(user, withUserId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await setChatTyping(user.id, withUserId, typing);
    return NextResponse.json({ ok: true });
}
