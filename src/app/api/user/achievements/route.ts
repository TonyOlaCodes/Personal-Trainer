import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiAuth";
import { getUserAchievementsDisplay } from "@/lib/achievements";

export async function GET() {
    const authResult = await requireAuthUser();
    if (authResult.error) return authResult.error;

    const achievements = await getUserAchievementsDisplay(authResult.user.id);
    const totalUnlocked = achievements.filter((a) => a.unlocked).length;

    return NextResponse.json({
        achievements,
        totalUnlocked,
        totalAchievements: achievements.length,
    });
}
