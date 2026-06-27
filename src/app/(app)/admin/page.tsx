import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { AdminClient } from "./AdminClient";
import { getUserAccountStatusMap } from "@/lib/userDeactivation";
import { dedupeAdminPlansByName } from "@/lib/coachPlans";

export const metadata = { title: "Admin Panel" };

function accountSortRank(account: { isDeleted: boolean; isDeactivated: boolean }) {
    if (account.isDeleted) return 2;
    if (account.isDeactivated) return 1;
    return 0;
}

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

    const [users, plans, recentCodes, coaches] = await Promise.all([
        prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
                createdAt: true,
                onboardingDone: true,
                coach: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
        }),
        prisma.plan.findMany({
            where: { creatorId: { in: creativeIds } },
            select: {
                id: true,
                name: true,
                type: true,
                creatorId: true,
                updatedAt: true,
                userPlans: {
                    where: { isActive: true },
                    select: {
                        user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } },
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
            take: 100,
        }),
        prisma.accessCode.findMany({
            include: {
                plan: { select: { name: true } },
                usedBy: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
        }),
        prisma.user.findMany({
            where: { role: { in: ["COACH", "SUPER_ADMIN"] } },
            select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                role: true,
                clients: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true,
                        role: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        }),
    ]);

    const accountStatusMap = await getUserAccountStatusMap([
        ...users.map((u) => u.id),
        ...coaches.map((coach) => coach.id),
        ...coaches.flatMap((coach) => coach.clients.map((client) => client.id)),
        ...plans.flatMap((plan) => plan.userPlans.map((assignment) => assignment.user.id)),
        ...recentCodes.flatMap((code) => code.usedBy?.id ? [code.usedBy.id] : []),
    ]);
    const activeCoaches = coaches.filter((coach) => {
        const status = accountStatusMap.get(coach.id);
        return !status?.isDeactivated && !status?.isDeleted;
    });
    const adminUsers = users
        .map((u) => {
            const status = accountStatusMap.get(u.id);
            return {
                id: u.id,
                name: status?.isDeleted ? status.deletedName ?? u.name : u.name,
                email: status?.isDeleted ? status.deletedEmail ?? u.email : u.email,
                avatarUrl: u.avatarUrl,
                role: u.role,
                createdAt: u.createdAt.toISOString(),
                onboardingDone: u.onboardingDone,
                isDeactivated: status?.isDeactivated ?? false,
                isDeleted: status?.isDeleted ?? false,
                coachName: u.coach?.name ?? u.coach?.email ?? null,
                coachId: u.coach?.id ?? null,
            };
        })
        .sort((a, b) => accountSortRank(a) - accountSortRank(b) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return (
        <>
            <TopBar title="Admin Panel" subtitle="Full platform management" />
            <div className="p-6 max-w-6xl mx-auto">
                <AdminClient
                    userRole={user.role}
                    users={adminUsers}
                    coaches={activeCoaches.map((c) => ({
                        id: c.id,
                        name: c.name,
                        email: c.email,
                        avatarUrl: c.avatarUrl,
                        role: c.role,
                        activeClientCount: c.clients.filter((client) => {
                            const status = accountStatusMap.get(client.id);
                            return client.role === "PREMIUM" && !status?.isDeactivated && !status?.isDeleted;
                        }).length,
                        clients: c.clients
                            .filter((client) => !accountStatusMap.get(client.id)?.isDeleted)
                            .map((client) => {
                                const status = accountStatusMap.get(client.id);
                                return {
                                    id: client.id,
                                    name: status?.isDeleted ? status.deletedName ?? client.name : client.name,
                                    email: status?.isDeleted ? status.deletedEmail ?? client.email : client.email,
                                    avatarUrl: client.avatarUrl,
                                    role: client.role,
                                    isDeactivated: status?.isDeactivated ?? false,
                                    isDeleted: status?.isDeleted ?? false,
                                };
                            })
                            .sort((a, b) =>
                                accountSortRank(a) - accountSortRank(b) ||
                                (a.name ?? a.email).localeCompare(b.name ?? b.email)
                            ),
                    }))}
                    plans={dedupeAdminPlansByName(plans.map((p) => ({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        creatorId: p.creatorId,
                        updatedAt: p.updatedAt,
                        userCount: p.userPlans.filter((assignment) => {
                            const status = accountStatusMap.get(assignment.user.id);
                            return !status?.isDeactivated && !status?.isDeleted;
                        }).length,
                        users: p.userPlans
                            .map((assignment) => {
                                const planUser = assignment.user;
                                const status = accountStatusMap.get(planUser.id);
                                return {
                                    id: planUser.id,
                                    name: status?.isDeleted ? status.deletedName ?? planUser.name : planUser.name,
                                    email: status?.isDeleted ? status.deletedEmail ?? planUser.email : planUser.email,
                                    avatarUrl: planUser.avatarUrl,
                                    role: planUser.role,
                                    isDeactivated: status?.isDeactivated ?? false,
                                    isDeleted: status?.isDeleted ?? false,
                                };
                            })
                            .sort((a, b) =>
                                accountSortRank(a) - accountSortRank(b) ||
                                (a.name ?? a.email).localeCompare(b.name ?? b.email)
                            ),
                    }))).map(({ updatedAt: _updatedAt, creatorId: _creatorId, ...plan }) => plan)}
                    codes={recentCodes.map((c) => ({
                        id: c.id,
                        code: c.code,
                        planName: c.plan?.name ?? null,
                        usedBy: c.usedBy
                            ? (accountStatusMap.get(c.usedBy.id)?.isDeleted
                                ? accountStatusMap.get(c.usedBy.id)?.deletedName ?? c.usedBy.name ?? c.usedBy.email
                                : c.usedBy.name ?? c.usedBy.email)
                            : null,
                        usedById: c.usedBy?.id ?? null,
                        usedByStatus: c.usedBy
                            ? (accountStatusMap.get(c.usedBy.id)?.isDeleted
                                ? "DELETED"
                                : accountStatusMap.get(c.usedBy.id)?.isDeactivated
                                    ? "DEACTIVATED"
                                    : "ACTIVE")
                            : null,
                        upgradesTo: c.upgradesTo,
                        isActive: c.isActive,
                        status: c.status,
                        createdAt: c.createdAt.toISOString(),
                        expiresAt: c.expiresAt?.toISOString() ?? null,
                    }))}
                />
            </div>
        </>
    );
}
