import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anonymizeDeletedUserAccount } from "@/lib/accountDeletion";
import { setUserDeactivationStatus } from "@/lib/userDeactivation";
import { z } from "zod";

const schema = z.object({
    userId: z.string(),
    action: z.enum(["deactivate", "reactivate", "delete"]),
});

export async function PATCH(req: Request) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actor = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!actor || actor.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { userId: targetId, action } = parsed.data;
    if (targetId === actor.id) {
        return NextResponse.json({ error: "You cannot change your own account status here" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (action === "delete") {
        const clerkId = target.clerkId;
        await anonymizeDeletedUserAccount(prisma, target);

        try {
            const client = await clerkClient();
            await client.users.deleteUser(clerkId);
        } catch (error) {
            console.warn("[Admin] Local account deleted, Clerk delete failed:", error);
        }

        return NextResponse.json({ success: true });
    }

    await setUserDeactivationStatus(targetId, action === "deactivate");

    return NextResponse.json({ success: true });
}
