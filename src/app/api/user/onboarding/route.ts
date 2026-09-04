import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redeemAccessCodeForUser } from "@/lib/accessCodes";
import { anonymizeDeletedUserAccount } from "@/lib/accountDeletion";
import { updateClientGoalTargets } from "@/lib/clientGoalTargets";
import { getUserDeactivationStatusByClerkId } from "@/lib/userDeactivation";
import { defaultHomeForRole } from "@/lib/roles";
import { triggerAchievementSync } from "@/lib/achievements";
import { ensureUnitSystemColumn } from "@/lib/units";
import {
    buildDisplayName,
    DEFAULT_ONBOARDING_HIDDEN_GOALS,
    DEFAULT_ONBOARDING_NOTIFICATION_PREFS,
    ensureOnboardingProfileColumns,
    GENDER_OPTIONS,
    isUsernameAvailable,
    normalizeUsername,
    parseDateOfBirth,
} from "@/lib/onboardingProfile";
import { getCoachCodeRequestStatus, createCoachCodeRequest } from "@/lib/coachCodeRequest";
import { z } from "zod";

const genderValues = GENDER_OPTIONS.map((option) => option.id);

const schema = z.object({
    firstName: z.string().min(1).max(80),
    lastName: z.string().max(80).optional(),
    username: z.string().max(20).optional(),
    gender: z.enum(genderValues as [string, ...string[]]),
    dateOfBirth: z.string().min(1),
    goal: z.enum(["GAIN_MUSCLE", "LOSE_WEIGHT", "RECOMPOSITION", "STRENGTH"]),
    trainingDaysPerWeek: z.number().min(2).max(6),
    experienceLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
    trainingLocation: z.enum(["GYM", "HOME"]),
    sessionLengthMin: z.number().min(30).max(120).nullable().optional(),
    hasInjuries: z.boolean(),
    injuryDetails: z.string().optional(),
    heightCm: z.string().optional(),
    weightKg: z.string().optional(),
    targetWeightKg: z.string().optional(),
    unitSystem: z.enum(["METRIC", "IMPERIAL"]).optional(),
    targetCalories: z.string().optional(),
    targetSteps: z.string().optional(),
    targetSleepHours: z.string().optional(),
    secretCode: z.string().optional(),
    coachCodeRequested: z.boolean().optional(),
});

export async function POST(req: Request) {
    try {
        await ensureUnitSystemColumn(prisma);
        await ensureOnboardingProfileColumns();

        const { userId } = await auth();
        const user = await currentUser();
        if (!userId || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

        const d = parsed.data;
        const dateOfBirth = parseDateOfBirth(d.dateOfBirth);
        if (!dateOfBirth) {
            return NextResponse.json({ error: "Must be at least 13." }, { status: 400 });
        }

        const normalizedUsername = normalizeUsername(d.username);
        if (d.username?.trim() && !normalizedUsername) {
            return NextResponse.json(
                { error: "Username must be 20 characters or fewer." },
                { status: 400 }
            );
        }

        const toFloat = (v?: string) => (v && v !== "" ? parseFloat(v) : null);
        const toInt = (v?: string) => (v && v !== "" ? parseInt(v, 10) : null);

        const email = user.emailAddresses[0]?.emailAddress ?? "unknown@example.com";
        const clerkFirstName = user.firstName?.trim() || "";
        const clerkLastName = user.lastName?.trim() || "";
        const firstName = d.firstName.trim();
        const lastName = d.lastName?.trim() || null;
        const displayName = buildDisplayName(firstName, lastName) ?? buildDisplayName(clerkFirstName, clerkLastName);

        const existingUser = await prisma.user.findUnique({ where: { clerkId: userId } });
        if (existingUser && await getUserDeactivationStatusByClerkId(userId)) {
            return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
        }

        if (normalizedUsername) {
            const available = await isUsernameAvailable(normalizedUsername, existingUser?.id);
            if (!available) {
                return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
            }
        }

        const accessCode = d.secretCode?.trim();
        let savedUserId = existingUser?.id;

        const profileData = {
            clerkId: userId,
            name: displayName,
            firstName,
            lastName,
            username: normalizedUsername,
            gender: d.gender,
            dateOfBirth,
            avatarUrl: user.imageUrl,
            onboardingDone: true,
            goal: d.goal as never,
            trainingDaysPerWeek: d.trainingDaysPerWeek,
            experienceLevel: d.experienceLevel as never,
            trainingLocation: d.trainingLocation as never,
            sessionLengthMin: d.sessionLengthMin ?? null,
            hasInjuries: d.hasInjuries,
            injuryDetails: d.hasInjuries ? d.injuryDetails?.trim() || null : null,
            heightCm: toFloat(d.heightCm),
            weightKg: toFloat(d.weightKg),
            targetWeightKg: toFloat(d.targetWeightKg),
            unitSystem: d.unitSystem ?? "METRIC",
            hiddenGoals: DEFAULT_ONBOARDING_HIDDEN_GOALS,
            ...DEFAULT_ONBOARDING_NOTIFICATION_PREFS,
        };

        if (existingUser) {
            const savedUser = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    ...profileData,
                    role: existingUser.role as never,
                    email: existingUser.email,
                },
            });
            savedUserId = savedUser.id;
        } else {
            if (email !== "unknown@example.com") {
                const staleEmailUser = await prisma.user.findUnique({ where: { email } });
                if (staleEmailUser && staleEmailUser.clerkId !== userId) {
                    await anonymizeDeletedUserAccount(prisma, staleEmailUser);
                }
            }

            const savedUser = await prisma.user.create({
                data: {
                    ...profileData,
                    email,
                    role: "FREE",
                },
            });
            savedUserId = savedUser.id;
        }

        if (accessCode && savedUserId) {
            const result = await redeemAccessCodeForUser(prisma, { id: savedUserId }, accessCode);
            if ("error" in result) {
                return NextResponse.json({ error: result.error }, { status: result.status });
            }
            if ("success" in result && result.success && "generatedBy" in result && result.generatedBy) {
                triggerAchievementSync(result.generatedBy);
            }
        }

        if (savedUserId) {
            await updateClientGoalTargets(savedUserId, {
                targetCalories: toInt(d.targetCalories),
                targetSteps: toInt(d.targetSteps),
                targetSleepHours: toFloat(d.targetSleepHours),
            });
        }

        const finalUser = savedUserId
            ? await prisma.user.findUnique({ where: { id: savedUserId }, select: { role: true } })
            : null;
        const role = finalUser?.role ?? "FREE";

        let coachCodeRequestSent = false;
        if (savedUserId && d.coachCodeRequested && role === "FREE") {
            try {
                await createCoachCodeRequest(savedUserId);
                coachCodeRequestSent = true;
            } catch (err) {
                console.error("[Onboarding] Failed to queue coach code request:", err);
            }
        }

        const coachCodeRequest = savedUserId ? await getCoachCodeRequestStatus(savedUserId) : null;

        if (savedUserId) {
            triggerAchievementSync(savedUserId);
        }

        return NextResponse.json({
            success: true,
            role,
            coachCodeRequested: Boolean(coachCodeRequest?.request || coachCodeRequestSent || d.coachCodeRequested),
            redirectTo:
                accessCode && (role === "PREMIUM" || role === "GENERAL_PREMIUM")
                    ? "/dashboard"
                    : defaultHomeForRole(role),
        });
    } catch (err) {
        console.error("[Onboarding] Failed to save profile:", err);
        return NextResponse.json(
            { error: "Could not save profile. Check the database connection and try again." },
            { status: 500 }
        );
    }
}
