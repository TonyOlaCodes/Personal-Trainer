import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { CoachDashboardClient } from "./CoachDashboardClient";

export const metadata = { title: "Coach Dashboard" };

export default async function CoachDashboardPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const coach = await prisma.user.findUnique({
        where: { clerkId: userId },
        include: {
            clients: {
                select: {
                    id: true, name: true, email: true, role: true, avatarUrl: true,
                    _count: { select: { workoutLogs: true, checkIns: true } }
                }
            }
        }
    });

    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        redirect("/dashboard");
    }

    // Get recent activity across all clients
    const recentCheckIns = await prisma.checkIn.findMany({
        where: { user: { coachId: coach.id } },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5
    });

    return (
        <>
            <TopBar title="Coach Command Centre" subtitle="Manage your stable of athletes" />
            <div className="p-6 max-w-6xl mx-auto">
                <CoachDashboardClient
                    clients={coach.clients.map(c => ({
                        id: c.id,
                        name: c.name || "Unnamed Client",
                        email: c.email,
                        avatarUrl: c.avatarUrl,
                        stats: { logs: c._count.workoutLogs, checkins: c._count.checkIns }
                    }))}
                    recentCheckIns={recentCheckIns.map(ci => ({
                        id: ci.id,
                        clientName: ci.user.name || "Client",
                        week: ci.weekNumber,
                        date: ci.createdAt.toISOString(),
                        status: ci.coachResponse ? "Responded" : "Pending"
                    }))}
                />
            </div>
        </>
    );
}
