import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthUser, canDirectMessage } from "@/lib/apiAuth";
import { withResolvedAvatar } from "@/lib/uploadUrls";
import {
    canViewUserProfile,
    ensureUserProfileColumns,
    getPublicAchievements,
    getPublicPlansForUser,
    getWorkoutStreak,
} from "@/lib/userProfile";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
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

    const target = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
            bio: true,
            experienceLevel: true,
            isPrivateProfile: true,
            isDeleted: true,
            deletedName: true,
            coachId: true,
        },
    });

    if (!target || target.isDeleted) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isSelf = viewer.id === targetUserId;
    const isAdmin = viewer.role === "SUPER_ADMIN";
    const isAssignedCoach = target.coachId === viewer.id && viewer.role === "COACH";

    const [streak, achievements, publicPlans, allOwnedPlans] = await Promise.all([
        getWorkoutStreak(targetUserId),
        getPublicAchievements(targetUserId),
        getPublicPlansForUser(targetUserId),
        (isSelf || isAdmin || isAssignedCoach)
            ? prisma.plan.findMany({
                where: { creatorId: targetUserId, type: "USER_CREATED" },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    tags: true,
                    isPublic: true,
                    createdAt: true,
                    _count: { select: { weeks: true } },
                },
                orderBy: { createdAt: "desc" },
            })
            : Promise.resolve([]),
    ]);

    const plansSource = (isSelf || isAdmin || isAssignedCoach) ? allOwnedPlans : publicPlans;

    const canMessage = !isSelf && (await canDirectMessage(viewer, targetUserId));

    return NextResponse.json({
        profile: {
            ...withResolvedAvatar({
                id: target.id,
                name: target.name ?? "Athlete",
                avatarUrl: target.avatarUrl,
                role: target.role,
                bio: target.bio ?? null,
                experienceLevel: target.experienceLevel ?? null,
                isPrivateProfile: target.isPrivateProfile ?? false,
            }),
            streak,
            achievements,
            plans: plansSource.map((plan) => ({
                id: plan.id,
                name: plan.name,
                description: plan.description,
                tags: plan.tags,
                isPublic: plan.isPublic,
                weekCount: plan._count.weeks,
                createdAt: plan.createdAt.toISOString(),
            })),
        },
        viewer: {
            isSelf,
            isAdmin,
            isAssignedCoach,
            canMessage,
            canCopyPlans: !isSelf,
        },
    });
}
