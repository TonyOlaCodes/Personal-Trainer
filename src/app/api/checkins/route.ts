import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CheckInStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { createNotification, notifyCoachOfClientCheckIn, userWantsNotification } from "@/lib/notifications";
import { withResolvedCheckInMedia } from "@/lib/uploadUrls";
import { isInactiveAccount } from "@/lib/userDeactivation";

const checkInSchema = z.object({
    bodyweightKg: z.number().optional(),
    feedback: z.string().optional(),
    notes: z.string().optional(),
    videoUrl: z.string().optional(),
    weekNumber: z.number(),
    sleepRating: z.number().min(1).max(5).optional(),
    dietRating: z.number().min(1).max(5).optional(),
    stressRating: z.number().min(1).max(5).optional(),
    injuryRating: z.number().min(1).max(5).optional(),
    energyRating: z.number().min(1).max(5).optional(),
    intensityRating: z.number().min(1).max(5).optional(),
    frontImageUrl: z.string().optional(),
    sideImageUrl: z.string().optional(),
});

// POST submit a check-in
export async function POST(req: Request) {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { clerkId } });
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        // Coaches do not submit client check-ins — they review them
        if (user.role === "COACH") {
            return NextResponse.json({ error: "Coaches cannot submit check-ins" }, { status: 403 });
        }

        if (user.role === "FREE") {
            return NextResponse.json({ error: "Check-ins require Premium" }, { status: 403 });
        }

        const body = await req.json();
        const parsed = checkInSchema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

        const checkIn = await prisma.checkIn.create({
            data: {
                userId: user.id,
                ...parsed.data,
                bodyweightKg: parsed.data.bodyweightKg ? Math.round(parsed.data.bodyweightKg * 100) / 100 : undefined,
                feedback: parsed.data.feedback || "Check-in completed.",
                status: "PENDING",
            },
        });

        if (user.coachId) {
            await notifyCoachOfClientCheckIn({
                coachId: user.coachId,
                clientName: user.name ?? user.email,
                checkInId: checkIn.id,
            });
        }

        return NextResponse.json(withResolvedCheckInMedia(checkIn), { status: 201 });
    } catch (error) {
        console.error("Error in POST /api/checkins:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// GET check-ins (personal or client dashboard)
export async function GET(req: Request) {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { clerkId } });
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const url = new URL(req.url);
        const clientId = url.searchParams.get("clientId");

        let where: Prisma.CheckInWhereInput = { userId: user.id };

        // Coaches can see all their clients or a specific one
        if (["COACH", "SUPER_ADMIN"].includes(user.role)) {
            if (clientId) {
                if (user.role === "SUPER_ADMIN") {
                    where = { userId: clientId };
                } else {
                    where = { userId: clientId, user: { coachId: user.id } };
                }
            } else if (user.role === "SUPER_ADMIN") {
                where = {};
            } else {
                where = { user: { coachId: user.id } };
            }
        }

        const checkIns = await prisma.checkIn.findMany({
            where,
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        workoutLogs: {
                            take: 15,
                            orderBy: { loggedAt: "desc" },
                            include: {
                                workout: { select: { name: true } },
                                sets: {
                                    where: { videoUrl: { not: null } },
                                    include: { exercise: { select: { name: true } } },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { weekNumber: "desc" },
        });

        return NextResponse.json(checkIns.map(withResolvedCheckInMedia));
    } catch (error) {
        console.error("Error in GET /api/checkins:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// PATCH for coach review OR user edit
export async function PATCH(req: Request) {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { clerkId } });
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const body = await req.json();
        const { id, coachResponse, status, feedback, notes, videoUrl, bodyweightKg, sleepRating, dietRating, stressRating, injuryRating, energyRating, intensityRating, frontImageUrl, sideImageUrl } = body;

        const existing = await prisma.checkIn.findUnique({
            where: { id },
            include: { user: { select: { coachId: true } } },
        });

        if (!existing) return NextResponse.json({ error: "Check-in not found" }, { status: 404 });

        const isCoach = ["COACH", "SUPER_ADMIN"].includes(user.role);
        const isOwner = existing.userId === user.id;

        if (!isCoach && !isOwner) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (isCoach && user.role !== "SUPER_ADMIN" && existing.user.coachId !== user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (isCoach) {
            const athlete = await prisma.user.findUnique({
                where: { id: existing.userId },
                select: { email: true, isDeleted: true, isDeactivated: true },
            });
            if (athlete && isInactiveAccount(athlete)) {
                return NextResponse.json({ error: "This account is inactive and cannot be edited" }, { status: 403 });
            }
        }

        // Determine what to update based on who is editing
        const parsedStatus = status === "PENDING" || status === "REVIEWED" ? status : "REVIEWED";
        let data: Prisma.CheckInUpdateInput = {};

        if (isCoach) {
            data = {
                coachResponse,
                coachVideoUrl: body.coachVideoUrl,
                status: parsedStatus as CheckInStatus,
                respondedAt: new Date(),
                coachLastSeenAt: new Date(),
            };
        } else {
            // User edit
            data = {
                feedback: feedback || "Check-in updated.",
                notes,
                videoUrl,
                bodyweightKg: bodyweightKg ? Math.round(parseFloat(bodyweightKg) * 100) / 100 : undefined,
                sleepRating,
                dietRating,
                stressRating,
                injuryRating,
                energyRating,
                intensityRating,
                frontImageUrl,
                sideImageUrl,
                lastUpdatedByClientAt: new Date(),
                status: "PENDING",
            };
        }

        const updated = await prisma.checkIn.update({
            where: { id },
            data,
        });

        if (isCoach && (await userWantsNotification(existing.userId, "notifyOnCheckInReview"))) {
            await createNotification({
                userId: existing.userId,
                type: "CHECKIN_REVIEWED",
                message: "Your coach reviewed your check-in",
                entityType: "CHECK_IN",
                entityId: existing.id,
                route: `/checkins?highlight=${existing.id}`,
            });
        }

        return NextResponse.json(withResolvedCheckInMedia(updated));
    } catch (error) {
        console.error("Error in PATCH /api/checkins:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
