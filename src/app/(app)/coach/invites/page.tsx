import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { CoachInvitesClient } from "./CoachInvitesClient";
import { getUserAccountStatusMap } from "@/lib/userDeactivation";
import { dedupeCoachPlansByName } from "@/lib/coachPlans";

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

    const [rawPlans, codes] = await Promise.all([
        prisma.plan.findMany({
            where: { creatorId: coach.id },
            select: { id: true, name: true, type: true, updatedAt: true },
            orderBy: { updatedAt: "desc" },
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

    const plans = dedupeCoachPlansByName(rawPlans).map(({ updatedAt: _updatedAt, ...plan }) => plan);
    const accountStatusMap = await getUserAccountStatusMap(
        codes.flatMap((code) => code.usedBy?.id ? [code.usedBy.id] : [])
    );

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
                        usedByName: c.usedBy
                            ? (accountStatusMap.get(c.usedBy.id)?.isDeleted
                                ? accountStatusMap.get(c.usedBy.id)?.deletedName ?? c.usedBy.name
                                : c.usedBy.name)
                            : null,
                        usedByEmail: c.usedBy
                            ? (accountStatusMap.get(c.usedBy.id)?.isDeleted
                                ? accountStatusMap.get(c.usedBy.id)?.deletedEmail ?? c.usedBy.email
                                : c.usedBy.email)
                            : null,
                        usedById: c.usedBy?.id ?? null,
                        usedByDeleted: c.usedBy ? (accountStatusMap.get(c.usedBy.id)?.isDeleted ?? false) : false,
                        isActive: c.isActive,
                        status: c.status,
                        createdAt: c.createdAt.toISOString(),
                        expiresAt: c.expiresAt?.toISOString() ?? null,
                        upgradesTo: c.upgradesTo
                    }))} 
                />
            </div>
        </>
    );
}
