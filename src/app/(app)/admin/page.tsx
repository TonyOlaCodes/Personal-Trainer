import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { AdminClient } from "./AdminClient";

export const metadata = { title: "Admin Panel" };

export default async function AdminPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user || user.role !== "SUPER_ADMIN") redirect("/dashboard");

    // Workaround since prisma generate is failing: fetch admin/coach IDs manually
    const admins = await prisma.user.findMany({
        where: { role: { in: ["COACH", "SUPER_ADMIN"] } },
        select: { id: true }
    });
    const creativeIds = admins.map(a => a.id);

    const [users, plans, recentCodes] = await Promise.all([
        prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, createdAt: true, onboardingDone: true },
            orderBy: { createdAt: "desc" },
            take: 50,
        }),
        prisma.plan.findMany({
            where: { creatorId: { in: creativeIds } },
            select: { id: true, name: true, type: true, _count: { select: { userPlans: true } } },
            orderBy: { createdAt: "desc" },
            take: 100,
        }),
        prisma.accessCode.findMany({
            include: {
                plan: { select: { name: true } },
                usedBy: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
        }),
    ]);

    return (
        <>
            <TopBar title="Admin Panel" subtitle="Full platform management" />
            <div className="p-6 max-w-6xl mx-auto">
                <AdminClient
                    userRole={user.role}
                    users={users.map((u: any) => ({
                        id: u.id,
                        name: u.name,
                        email: u.email,
                        role: u.role,
                        createdAt: u.createdAt.toISOString(),
                        onboardingDone: u.onboardingDone,
                    }))}
                    plans={plans.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        userCount: p._count?.userPlans ?? 0,
                    }))}
                    codes={recentCodes.map((c: any) => ({
                        id: c.id,
                        code: c.code,
                        planName: c.plan?.name ?? null,
                        usedBy: c.usedBy?.name ?? null,
                        usedById: c.usedBy?.id ?? null,
                        upgradesTo: (c as any).upgradesTo,
                        isActive: c.isActive,
                        createdAt: c.createdAt.toISOString(),
                        expiresAt: c.expiresAt?.toISOString() ?? null,
                    }))}
                />
            </div>
        </>
    );
}
