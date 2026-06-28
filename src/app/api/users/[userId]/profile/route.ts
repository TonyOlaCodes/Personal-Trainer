import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthUser, canDirectMessage } from "@/lib/apiAuth";
import { getUserProfilePrivacy } from "@/lib/profilePrivacy";
import {
    buildPublicProfileData,
    canViewUserProfile,
    ensureUserProfileColumns,
} from "@/lib/userProfile";

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

        const allowed = await canViewUserProfile(
            { id: viewer.id, role: viewer.role },
            targetUserId
        );

        if (!allowed) {
            return NextResponse.json({ error: "This profile is private" }, { status: 403 });
        }

        const targetMeta = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { coachId: true, isDeleted: true },
        });

        if (!targetMeta || targetMeta.isDeleted) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const [profile, privacy] = await Promise.all([
            buildPublicProfileData(targetUserId, viewer.id),
            getUserProfilePrivacy(targetUserId),
        ]);

        if (!profile) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const isSelf = viewer.id === targetUserId;
        const isAdmin = viewer.role === "SUPER_ADMIN";
        const isAssignedCoach = targetMeta.coachId === viewer.id && viewer.role === "COACH";

        const canMessage =
            !isSelf &&
            privacy.allowMessages &&
            (await canDirectMessage(viewer, targetUserId));

        return NextResponse.json({
            profile,
            viewer: {
                isSelf,
                isAdmin,
                isAssignedCoach,
                canMessage,
                canCopyPlans: !isSelf && privacy.publicPlans,
            },
        });
    } catch (error) {
        console.error("[GET /api/users/[userId]/profile]", error);
        return NextResponse.json({ error: "Could not load profile" }, { status: 500 });
    }
}
