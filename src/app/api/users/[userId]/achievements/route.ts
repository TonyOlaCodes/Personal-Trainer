import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthUser } from "@/lib/apiAuth";
import {
    getProfileViewMode,
    ensureUserProfileColumns,
} from "@/lib/userProfile";
import { getUserAchievementsDisplay } from "@/lib/achievements";

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

        if (viewMode === "limited") {
            return NextResponse.json({ error: "Achievements are private" }, { status: 403 });
        }

        const achievements = await getUserAchievementsDisplay(targetUserId);
        const totalUnlocked = achievements.filter((a) => a.unlocked).length;

        return NextResponse.json({
            achievements,
            totalUnlocked,
            totalAchievements: achievements.length,
        });
    } catch (error) {
        console.error("[GET /api/users/[userId]/achievements]", error);
        return NextResponse.json({ error: "Could not load achievements" }, { status: 500 });
    }
}
