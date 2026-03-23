import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const checkInSchema = z.object({
    bodyweightKg: z.number().optional(),
    feedback: z.string().min(1),
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
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.role === "FREE") {
        return NextResponse.json({ error: "Check-ins require Premium" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const existingWeek = await prisma.checkIn.findFirst({
        where: { userId: user.id, weekNumber: parsed.data.weekNumber },
    });
    if (existingWeek) return NextResponse.json({ error: "Check-in for this week already exists." }, { status: 400 });

    const checkIn = await prisma.checkIn.create({
        data: { userId: user.id, ...parsed.data, status: "PENDING" },
    });

    return NextResponse.json(checkIn, { status: 201 });
}

// GET check-ins (personal or client dashboard)
export async function GET(req: Request) {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId");

    let where: any = { userId: user.id };
    
    // Coaches can see all their clients or a specific one
    if (["COACH", "SUPER_ADMIN"].includes(user.role)) {
        if (clientId) {
            where = { userId: clientId, user: { coachId: user.id } };
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
                                include: { exercise: { select: { name: true } } }
                            }
                        }
                    }
                } 
            } 
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(checkIns);
}

// PATCH for coach review OR user edit
export async function PATCH(req: Request) {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const { id, coachResponse, status, feedback, notes, videoUrl, bodyweightKg, sleepRating, dietRating, stressRating, injuryRating, energyRating, intensityRating, frontImageUrl, sideImageUrl } = body;
    
    const existing = await prisma.checkIn.findUnique({
        where: { id },
    });
    
    if (!existing) return NextResponse.json({ error: "Check-in not found" }, { status: 404 });

    const isCoach = ["COACH", "SUPER_ADMIN"].includes(user.role);
    const isOwner = existing.userId === user.id;

    if (!isCoach && !isOwner) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Determine what to update based on who is editing
    let data: any = {};

    if (isCoach) {
        data = {
            coachResponse,
            status: (status as any) || "REVIEWED",
            respondedAt: new Date(),
            coachLastSeenAt: new Date(),
        };
    } else {
        // User edit
        data = {
            feedback,
            notes,
            videoUrl,
            bodyweightKg: bodyweightKg ? parseFloat(bodyweightKg) : undefined,
            sleepRating,
            dietRating,
            stressRating,
            injuryRating,
            energyRating,
            intensityRating,
            frontImageUrl,
            sideImageUrl,
            lastUpdatedByClientAt: new Date(),
        };
    }
    
    const updated = await prisma.checkIn.update({
        where: { id },
        data
    });

    return NextResponse.json(updated);
}
