import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateClientGoalTargets } from "@/lib/clientGoalTargets";
import { ensureNotificationPreferenceColumns, getCoachNotifyOnClientMessage, setCoachNotifyOnClientMessage } from "@/lib/notifications";
import {
    ensureProfileExtendedColumns,
    parseProfilePrivacy,
    parseSocialLinks,
    updateUserProfilePrivacy,
    updateUserSocialLinks,
    type ProfilePrivacy,
    type SocialLinks,
} from "@/lib/profilePrivacy";
import { ensureUserProfileColumns } from "@/lib/userProfile";
import { normalizeNotifyTime } from "@/lib/coachNotificationSchedule";
import { normalizeStoredUploadUrl, withResolvedAvatar } from "@/lib/uploadUrls";
import { z } from "zod";

const storedUploadUrlSchema = z.string().refine(
    (val) =>
        val.startsWith("http://") ||
        val.startsWith("https://") ||
        val.startsWith("/uploads/") ||
        val.startsWith("/api/uploads/"),
    { message: "Invalid avatar URL" }
);

const profileSchema = z.object({
    name: z.string().min(1).max(50).optional(),
    avatarUrl: z.union([storedUploadUrlSchema, z.literal("")]).optional(),
    // Goals fields
    goal: z.enum(["GAIN_MUSCLE", "LOSE_WEIGHT", "RECOMPOSITION", "STRENGTH"]).optional(),
    trainingDaysPerWeek: z.number().int().min(1).max(7).optional(),
    experienceLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
    trainingLocation: z.enum(["GYM", "HOME"]).optional(),
    targetWeightKg: z.number().optional(),
    weightKg: z.number().optional(),
    targetCalories: z.number().nullable().optional(),
    targetSteps: z.number().nullable().optional(),
    targetSleepHours: z.number().nullable().optional(),
    hiddenGoals: z.array(z.string()).optional(),
    bio: z.string().max(280).nullable().optional(),
    isPrivateProfile: z.boolean().optional(),
    bannerUrl: z.union([storedUploadUrlSchema, z.literal("")]).optional(),
    profilePrivacy: z
        .object({
            bio: z.boolean().optional(),
            bodyweight: z.boolean().optional(),
            prs: z.boolean().optional(),
            workoutStats: z.boolean().optional(),
            achievements: z.boolean().optional(),
            progressPhotos: z.boolean().optional(),
            publicPlans: z.boolean().optional(),
            activityFeed: z.boolean().optional(),
            onlineStatus: z.boolean().optional(),
            allowMessages: z.boolean().optional(),
            socialLinks: z.boolean().optional(),
        })
        .optional(),
    socialLinks: z
        .object({
            instagram: z.string().max(120).optional(),
            tiktok: z.string().max(120).optional(),
            youtube: z.string().max(120).optional(),
            website: z.string().max(200).optional(),
        })
        .optional(),
    notifyOnWorkout: z.boolean().optional(),
    notifyOnCheckIn: z.boolean().optional(),
    notifyOnMetricUpdate: z.boolean().optional(),
    notifyOnCoachMessage: z.boolean().optional(),
    notifyOnPlanUpdate: z.boolean().optional(),
    notifyOnCheckInReview: z.boolean().optional(),
    notifyOnWorkoutFeedback: z.boolean().optional(),
    notifyOnMissedCheckIn: z.boolean().optional(),
    notifyOnMissedWorkout: z.boolean().optional(),
    notifyOnClientMessage: z.boolean().optional(),
    notifyOnWorkoutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^$/).nullable().optional(),
    notifyOnCheckInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^$/).nullable().optional(),
    notifyOnMetricUpdateTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^$/).nullable().optional(),
    notifyOnMissedCheckInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    notifyOnMissedWorkoutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
});

export async function PATCH(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const parsed = profileSchema.parse(body);
        const normalizedAvatar =
            parsed.avatarUrl !== undefined
                ? parsed.avatarUrl === ""
                    ? null
                    : normalizeStoredUploadUrl(parsed.avatarUrl)
                : undefined;
        const normalizedBanner =
            parsed.bannerUrl !== undefined
                ? parsed.bannerUrl === ""
                    ? null
                    : normalizeStoredUploadUrl(parsed.bannerUrl)
                : undefined;

        await ensureNotificationPreferenceColumns();
        await ensureUserProfileColumns();
        await ensureProfileExtendedColumns();

        const notifyOnClientMessageUpdate = parsed.notifyOnClientMessage;

        let updated;
        try {
            updated = await prisma.user.update({
                where: { clerkId: userId },
                data: {
                    ...(parsed.name !== undefined && { name: parsed.name }),
                    ...(parsed.avatarUrl !== undefined && { avatarUrl: normalizedAvatar }),
                    ...(parsed.goal !== undefined && { goal: parsed.goal }),
                    ...(parsed.trainingDaysPerWeek !== undefined && { trainingDaysPerWeek: parsed.trainingDaysPerWeek }),
                    ...(parsed.experienceLevel !== undefined && { experienceLevel: parsed.experienceLevel }),
                    ...(parsed.trainingLocation !== undefined && { trainingLocation: parsed.trainingLocation }),
                    ...(parsed.weightKg !== undefined && { weightKg: Math.round(parsed.weightKg * 100) / 100 }),
                    ...(parsed.hiddenGoals !== undefined && { hiddenGoals: parsed.hiddenGoals }),
                    ...(parsed.bio !== undefined && { bio: parsed.bio?.trim() ? parsed.bio.trim() : null }),
                    ...(parsed.isPrivateProfile !== undefined && { isPrivateProfile: parsed.isPrivateProfile }),
                    ...(parsed.notifyOnWorkout !== undefined && { notifyOnWorkout: parsed.notifyOnWorkout }),
                    ...(parsed.notifyOnCheckIn !== undefined && { notifyOnCheckIn: parsed.notifyOnCheckIn }),
                    ...(parsed.notifyOnMetricUpdate !== undefined && { notifyOnMetricUpdate: parsed.notifyOnMetricUpdate }),
                    ...(parsed.notifyOnCoachMessage !== undefined && { notifyOnCoachMessage: parsed.notifyOnCoachMessage }),
                    ...(parsed.notifyOnPlanUpdate !== undefined && { notifyOnPlanUpdate: parsed.notifyOnPlanUpdate }),
                    ...(parsed.notifyOnCheckInReview !== undefined && { notifyOnCheckInReview: parsed.notifyOnCheckInReview }),
                    ...(parsed.notifyOnWorkoutFeedback !== undefined && { notifyOnWorkoutFeedback: parsed.notifyOnWorkoutFeedback }),
                    ...(parsed.notifyOnMissedCheckIn !== undefined && { notifyOnMissedCheckIn: parsed.notifyOnMissedCheckIn }),
                    ...(parsed.notifyOnMissedWorkout !== undefined && { notifyOnMissedWorkout: parsed.notifyOnMissedWorkout }),
                    ...(parsed.notifyOnWorkoutTime !== undefined && {
                        notifyOnWorkoutTime: parsed.notifyOnWorkoutTime ? normalizeNotifyTime(parsed.notifyOnWorkoutTime) : null,
                    }),
                    ...(parsed.notifyOnCheckInTime !== undefined && {
                        notifyOnCheckInTime: parsed.notifyOnCheckInTime ? normalizeNotifyTime(parsed.notifyOnCheckInTime) : null,
                    }),
                    ...(parsed.notifyOnMetricUpdateTime !== undefined && {
                        notifyOnMetricUpdateTime: parsed.notifyOnMetricUpdateTime ? normalizeNotifyTime(parsed.notifyOnMetricUpdateTime) : null,
                    }),
                    ...(parsed.notifyOnMissedCheckInTime !== undefined && {
                        notifyOnMissedCheckInTime: parsed.notifyOnMissedCheckInTime
                            ? normalizeNotifyTime(parsed.notifyOnMissedCheckInTime)
                            : null,
                    }),
                    ...(parsed.notifyOnMissedWorkoutTime !== undefined && {
                        notifyOnMissedWorkoutTime: parsed.notifyOnMissedWorkoutTime
                            ? normalizeNotifyTime(parsed.notifyOnMissedWorkoutTime)
                            : null,
                    }),
                },
            });
        } catch (dbErr) {
            console.warn("[Profile PATCH] Update failed, retrying without hiddenGoals field:", dbErr);
            updated = await prisma.user.update({
                where: { clerkId: userId },
                data: {
                    ...(parsed.name !== undefined && { name: parsed.name }),
                    ...(parsed.avatarUrl !== undefined && { avatarUrl: normalizedAvatar }),
                    ...(parsed.goal !== undefined && { goal: parsed.goal }),
                    ...(parsed.trainingDaysPerWeek !== undefined && { trainingDaysPerWeek: parsed.trainingDaysPerWeek }),
                    ...(parsed.experienceLevel !== undefined && { experienceLevel: parsed.experienceLevel }),
                    ...(parsed.trainingLocation !== undefined && { trainingLocation: parsed.trainingLocation }),
                    ...(parsed.weightKg !== undefined && { weightKg: Math.round(parsed.weightKg * 100) / 100 }),
                },
            });
        }

        if (notifyOnClientMessageUpdate !== undefined) {
            await setCoachNotifyOnClientMessage(updated.id, notifyOnClientMessageUpdate);
        }

        if (
            parsed.goal !== undefined
            || parsed.targetWeightKg !== undefined
            || parsed.targetCalories !== undefined
            || parsed.targetSteps !== undefined
            || parsed.targetSleepHours !== undefined
        ) {
            await updateClientGoalTargets(updated.id, {
                ...(parsed.goal !== undefined ? { goal: parsed.goal } : {}),
                ...(parsed.targetWeightKg !== undefined ? { targetWeightKg: parsed.targetWeightKg } : {}),
                ...(parsed.targetCalories !== undefined ? { targetCalories: parsed.targetCalories } : {}),
                ...(parsed.targetSteps !== undefined ? { targetSteps: parsed.targetSteps } : {}),
                ...(parsed.targetSleepHours !== undefined ? { targetSleepHours: parsed.targetSleepHours } : {}),
            });
        }

        if (normalizedBanner !== undefined) {
            await prisma.$executeRaw`
                UPDATE "users"
                SET "bannerUrl" = ${normalizedBanner},
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = ${updated.id}
            `;
        }

        if (parsed.profilePrivacy !== undefined) {
            await updateUserProfilePrivacy(updated.id, parsed.profilePrivacy as Partial<ProfilePrivacy>);
        }

        if (parsed.socialLinks !== undefined) {
            await updateUserSocialLinks(updated.id, parseSocialLinks(parsed.socialLinks) as SocialLinks);
        }

        let bannerUrl: string | null | undefined;
        let profilePrivacy: ProfilePrivacy | undefined;
        let socialLinksOut: SocialLinks | undefined;

        if (normalizedBanner !== undefined || parsed.profilePrivacy !== undefined || parsed.socialLinks !== undefined) {
            const rows = await prisma.$queryRaw<
                Array<{ bannerUrl: string | null; profilePrivacy: unknown; socialLinks: unknown }>
            >`
                SELECT "bannerUrl", "profilePrivacy", "socialLinks"
                FROM "users"
                WHERE "id" = ${updated.id}
                LIMIT 1
            `;
            const row = rows[0];
            if (row) {
                bannerUrl = row.bannerUrl;
                profilePrivacy = parseProfilePrivacy(row.profilePrivacy);
                socialLinksOut = parseSocialLinks(row.socialLinks);
            }
        }

        return NextResponse.json(
            withResolvedAvatar({
                ...updated,
                ...(bannerUrl !== undefined && { bannerUrl }),
                ...(profilePrivacy !== undefined && { profilePrivacy }),
                ...(socialLinksOut !== undefined && { socialLinks: socialLinksOut }),
            })
        );
    } catch (err) {
        console.error(err);
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid profile data" }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}
