import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthUser } from "@/lib/apiAuth";
import { getProfileViewMode } from "@/lib/userProfile";
import {
    getNickname,
    normalizeNicknameInput,
    pickDisplayName,
    setNickname,
} from "@/lib/userNicknames";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
    nickname: z.string().max(40).nullable(),
});

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    const authResult = await requireAuthUser(req);
    if (authResult.error) return authResult.error;

    const { userId: targetUserId } = await params;
    const viewer = authResult.user;

    if (viewer.id === targetUserId) {
        return NextResponse.json({ error: "You cannot set a nickname on your own profile" }, { status: 400 });
    }

    const viewMode = await getProfileViewMode(
        { id: viewer.id, role: viewer.role },
        targetUserId
    );
    if (viewMode === "none") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, name: true, email: true, isDeleted: true },
    });
    if (!target || target.isDeleted) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const saved = await setNickname(viewer.id, targetUserId, parsed.data.nickname);
    const chosenName = target.name?.trim() || target.email || "Athlete";

    return NextResponse.json({
        nickname: saved,
        chosenName,
        displayName: pickDisplayName(chosenName, target.email, saved),
    });
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    const { userId: targetUserId } = await params;
    const viewer = authResult.user;

    if (viewer.id === targetUserId) {
        return NextResponse.json({ nickname: null });
    }

    const nickname = await getNickname(viewer.id, targetUserId);
    return NextResponse.json({ nickname });
}
