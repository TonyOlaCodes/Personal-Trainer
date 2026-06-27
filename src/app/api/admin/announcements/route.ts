import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    ANNOUNCEMENT_AUDIENCES,
    createAnnouncement,
    deleteAnnouncement,
    listAnnouncementsForAdmin,
    serializeAnnouncement,
    updateAnnouncement,
} from "@/lib/announcements";

const audienceSchema = z.enum(ANNOUNCEMENT_AUDIENCES);

const createSchema = z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(5000),
    targetAudience: audienceSchema,
    targetUserIds: z.array(z.string()).optional(),
    scheduledAt: z.string().nullable().optional(),
    expiresAt: z.string().nullable().optional(),
    dashboardBannerDays: z.number().int().min(1).max(90).optional(),
});

const updateSchema = createSchema.partial();

async function requireAdmin() {
    const { userId } = await auth();
    if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user || user.role !== "SUPER_ADMIN") {
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }

    return { user };
}

export async function GET() {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const announcements = await listAnnouncementsForAdmin();
    return NextResponse.json(announcements.map(serializeAnnouncement));
}

export async function POST(req: Request) {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    try {
        const parsed = createSchema.parse(await req.json());

        if (parsed.targetAudience === "SELECTED" && (!parsed.targetUserIds || parsed.targetUserIds.length === 0)) {
            return NextResponse.json({ error: "Select at least one user" }, { status: 400 });
        }

        const created = await createAnnouncement({
            title: parsed.title,
            body: parsed.body,
            targetAudience: parsed.targetAudience,
            targetUserIds: parsed.targetUserIds,
            scheduledAt: parsed.scheduledAt ? new Date(parsed.scheduledAt) : null,
            expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
            dashboardBannerDays: parsed.dashboardBannerDays,
            createdById: authResult.user!.id,
        });

        if (!created) {
            return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
        }

        return NextResponse.json(serializeAnnouncement(created), { status: 201 });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: err.flatten() }, { status: 400 });
        }
        const message = err instanceof Error ? err.message : "Failed to create announcement";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function PATCH(req: Request) {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    try {
        const body = await req.json();
        const id = z.string().min(1).parse(body.id);
        const parsed = updateSchema.parse(body);

        if (parsed.targetAudience === "SELECTED" && parsed.targetUserIds !== undefined && parsed.targetUserIds.length === 0) {
            return NextResponse.json({ error: "Select at least one user" }, { status: 400 });
        }

        const updated = await updateAnnouncement(id, {
            title: parsed.title,
            body: parsed.body,
            targetAudience: parsed.targetAudience,
            targetUserIds: parsed.targetUserIds,
            scheduledAt: parsed.scheduledAt !== undefined
                ? (parsed.scheduledAt ? new Date(parsed.scheduledAt) : null)
                : undefined,
            expiresAt: parsed.expiresAt !== undefined
                ? (parsed.expiresAt ? new Date(parsed.expiresAt) : null)
                : undefined,
            dashboardBannerDays: parsed.dashboardBannerDays,
        });

        if (!updated) {
            return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
        }

        return NextResponse.json(serializeAnnouncement(updated));
    } catch (err) {
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: err.flatten() }, { status: 400 });
        }
        const message = err instanceof Error ? err.message : "Failed to update announcement";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function DELETE(req: Request) {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    try {
        const { id } = z.object({ id: z.string().min(1) }).parse(await req.json());
        await deleteAnnouncement(id);
        return NextResponse.json({ ok: true });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: err.flatten() }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to delete announcement" }, { status: 400 });
    }
}
