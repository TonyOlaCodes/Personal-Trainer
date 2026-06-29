import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthUser, canDirectMessage } from "@/lib/apiAuth";
import {
    buildPublicProfileData,
    canViewFullProfile,
    ensureUserProfileColumns,
    getProfileViewMode,
} from "@/lib/userProfile";
import { recordProfileView } from "@/lib/achievements";
import { getNickname } from "@/lib/userNicknames";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const authResult = await requireAuthUser();
        if (authResult.error) return authResult.error;

        const { userId: targetUserId } = await params;
        const viewer = authResult.user;

        await ensureUserProfileColumns();

        const viewMode = await getProfileViewMode(
            { id: viewer.id, role: viewer.role },
            targetUserId
        );

        if (viewMode === "none") {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const targetMeta = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { coachId: true, isDeleted: true },
        });

        if (!targetMeta || targetMeta.isDeleted) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (viewer.id !== targetUserId && viewMode !== "none") {
            await recordProfileView(viewer.id, targetUserId);
        }

        const profile = await buildPublicProfileData(targetUserId, viewer.id, viewMode);

        if (!profile) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const isSelf = viewer.id === targetUserId;
        const isAdmin = viewer.role === "SUPER_ADMIN";
        const isAssignedCoach = targetMeta.coachId === viewer.id && viewer.role === "COACH";
        const isLimitedView = viewMode === "limited";
        const canViewFull = await canViewFullProfile(
            { id: viewer.id, role: viewer.role },
            targetUserId
        );

        const canMessage =
            !isSelf &&
            !isLimitedView &&
            (await canDirectMessage(viewer, targetUserId));

        const viewerNickname = isSelf ? null : await getNickname(viewer.id, targetUserId);

        return NextResponse.json({
            profile,
            viewer: {
                isSelf,
                isAdmin,
                isAssignedCoach,
                isLimitedView,
                canMessage,
                canCopyPlans: !isSelf && canViewFull,
                canSetNickname: !isSelf,
                nickname: viewerNickname,
            },
        });
    } catch (error) {
        console.error("[GET /api/users/[userId]/profile]", error);
        return NextResponse.json({ error: "Could not load profile" }, { status: 500 });
    }
}
