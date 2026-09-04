import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthUser } from "@/lib/apiAuth";
import {
    getFeaturedAchievementKeys,
    setFeaturedAchievementKeys,
} from "@/lib/achievements/engine";
import { isCoachRole } from "@/lib/roles";

export async function GET() {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;
    if (isCoachRole(authResult.user.role)) {
        return NextResponse.json({ keys: [] });
    }
    const keys = await getFeaturedAchievementKeys(authResult.user.id);
    return NextResponse.json({ keys });
}

const putSchema = z.object({
    keys: z.array(z.string().min(1)).max(3),
});

export async function PUT(req: Request) {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;
    if (isCoachRole(authResult.user.role)) {
        return NextResponse.json({ error: "Not available for coaches" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Provide up to 3 achievement keys" }, { status: 400 });
    }

    const keys = await setFeaturedAchievementKeys(authResult.user.id, parsed.data.keys);
    return NextResponse.json({ keys });
}
