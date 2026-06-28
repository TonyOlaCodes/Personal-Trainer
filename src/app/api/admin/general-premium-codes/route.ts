import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateGeneralPremiumAccessCode } from "@/lib/accessCodes";
import { getUserAccountStatusMap } from "@/lib/userDeactivation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { randomBytes } from "crypto";
import { PLAN_TEMPLATES } from "@/lib/templates";

const createSchema = z.object({
    planId: z.string().nullable().optional(),
    templateId: z.string().nullable().optional(),
    expiresInHours: z.number().int().positive().optional(),
    isActive: z.boolean().optional(),
});

async function getOrCreateTemplatePlan(templateId: string, creatorId: string) {
    const template = PLAN_TEMPLATES[templateId];
    if (!template) return null;

    const existing = await prisma.plan.findFirst({
        where: { creatorId, type: "PREBUILT" as never, name: template.name },
        select: { id: true },
    });
    if (existing) return existing.id;

    const plan = await prisma.plan.create({
        data: {
            name: template.name,
            description: template.description,
            type: "PREBUILT" as never,
            creatorId,
            originalCreatorId: creatorId,
            shareCode: randomBytes(4).toString("hex").toUpperCase(),
            weeks: {
                create: [{
                    weekNumber: 1,
                    workouts: {
                        create: template.workouts.map((workout) => ({
                            name: workout.name,
                            dayNumber: workout.dayNumber,
                            dayOfWeek: (workout.dayNumber - 1) % 7,
                            exercises: {
                                create: workout.exercises.map((exercise, index) => ({
                                    name: exercise.name,
                                    sets: exercise.sets,
                                    reps: exercise.reps,
                                    order: index,
                                })),
                            },
                        })),
                    },
                }],
            },
        },
        select: { id: true },
    });

    return plan.id;
}

export async function GET(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user || user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") || "ALL";

    const where: Prisma.AccessCodeWhereInput = { upgradesTo: "GENERAL_PREMIUM" };

    if (filter === "USED") {
        where.usedById = { not: null };
    } else if (filter === "UNUSED") {
        where.usedById = null;
        where.isActive = true;
    } else if (filter === "INACTIVE") {
        where.isActive = false;
    }

    const codes = await prisma.accessCode.findMany({
        where,
        include: {
            plan: { select: { name: true } },
            usedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    const accountStatusMap = await getUserAccountStatusMap(
        codes.flatMap((c) => (c.usedBy?.id ? [c.usedBy.id] : []))
    );

    return NextResponse.json(codes.map((c) => ({
        ...c,
        planName: c.plan?.name ?? null,
        usedByName: c.usedBy
            ? (accountStatusMap.get(c.usedBy.id)?.isDeleted
                ? accountStatusMap.get(c.usedBy.id)?.deletedName ?? c.usedBy.name
                : c.usedBy.name)
            : null,
        usedByEmail: c.usedBy?.email ?? null,
        usedById: c.usedBy?.id ?? null,
        usedByStatus: c.usedBy
            ? (accountStatusMap.get(c.usedBy.id)?.isDeleted
                ? "DELETED"
                : accountStatusMap.get(c.usedBy.id)?.isDeactivated
                    ? "DEACTIVATED"
                    : "ACTIVE")
            : null,
    })));
}

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user || user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    let expiresAt: Date | null = null;
    if (parsed.data.expiresInHours) {
        expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + parsed.data.expiresInHours);
    }

    const planId = parsed.data.planId
        ?? (parsed.data.templateId ? await getOrCreateTemplatePlan(parsed.data.templateId, user.id) : null);

    const code = await prisma.accessCode.create({
        data: {
            code: await generateGeneralPremiumAccessCode(prisma),
            planId,
            generatedBy: user.id,
            upgradesTo: "GENERAL_PREMIUM",
            expiresAt,
            isActive: parsed.data.isActive ?? true,
        },
    });

    return NextResponse.json(code, { status: 201 });
}

export async function PATCH(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user || user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, isActive } = z.object({
        id: z.string(),
        isActive: z.boolean(),
    }).parse(await req.json());

    const code = await prisma.accessCode.findUnique({ where: { id } });
    if (!code || code.upgradesTo !== "GENERAL_PREMIUM") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (code.usedById) {
        return NextResponse.json({ error: "Cannot change a redeemed code" }, { status: 400 });
    }

    const updated = await prisma.accessCode.update({
        where: { id },
        data: {
            isActive,
            status: isActive ? "active" : "inactive",
        },
    });

    return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user || user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = z.object({ id: z.string() }).parse(await req.json());
    const code = await prisma.accessCode.findUnique({ where: { id } });
    if (!code || code.upgradesTo !== "GENERAL_PREMIUM") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.accessCode.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
