import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { ensureWalkthroughColumn } from "@/lib/walkthrough/ensureWalkthroughColumn";
import { z } from "zod";

const bodySchema = z.object({
    action: z.enum(["complete", "reset"]),
});

export async function GET() {
    try {
        await ensureWalkthroughColumn();
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const user = await prisma.user.findUnique({
            where: { clerkId: userId },
            select: { walkthroughDone: true, role: true },
        });

        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        return NextResponse.json({
            walkthroughDone: user.walkthroughDone ?? false,
            role: user.role,
        });
    } catch (error) {
        console.error("[Walkthrough GET]", error);
        return NextResponse.json({ error: "Failed to load walkthrough state" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await ensureWalkthroughColumn();
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const parsed = bodySchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        const walkthroughDone = parsed.data.action === "complete";

        await prisma.user.update({
            where: { clerkId: userId },
            data: { walkthroughDone },
        });

        return NextResponse.json({ success: true, walkthroughDone });
    } catch (error) {
        console.error("[Walkthrough POST]", error);
        return NextResponse.json({ error: "Failed to update walkthrough state" }, { status: 500 });
    }
}
