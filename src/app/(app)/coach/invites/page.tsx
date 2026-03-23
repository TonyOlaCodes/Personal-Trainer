import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { CoachInvitesClient } from "./CoachInvitesClient";

export const metadata = { title: "Invite Clients" };

export default async function CoachInvitesPage() {
    const { userId: clerkId } = await auth();
    if (!clerkId) redirect("/sign-in");

    const coach = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true, role: true }
    });

    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        redirect("/dashboard");
    }

    const [plans, codes] = await Promise.all([
        prisma.plan.findMany({
            where: { creatorId: coach.id },
            select: { id: true, name: true }
        }),
        prisma.accessCode.findMany({
            where: { generatedBy: coach.id },
            include: {
                plan: { select: { name: true } },
                usedBy: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
        })
    ]);

    return (
        <>
            <TopBar title="Invite Clients" subtitle="Generate access codes for your new athletes" />
            <div className="p-6 max-w-5xl mx-auto">
                <CoachInvitesClient 
                    plans={plans} 
                    initialCodes={codes.map(c => ({
                        id: c.id,
                        code: c.code,
                        planName: c.plan?.name ?? null,
                        usedByName: c.usedBy?.name ?? null,
                        usedByEmail: c.usedBy?.email ?? null,
                        isActive: c.isActive,
                        createdAt: c.createdAt.toISOString(),
                        expiresAt: c.expiresAt?.toISOString() ?? null,
                        upgradesTo: c.upgradesTo
                    }))} 
                />
            </div>
        </>
    );
}
