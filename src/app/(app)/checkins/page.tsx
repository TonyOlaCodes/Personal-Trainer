import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { CheckInsClient } from "./CheckInsClient";

export const metadata = { title: "Check-ins" };

export default async function CheckInsPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) redirect("/sign-in");

    const isCoach = ["COACH", "SUPER_ADMIN"].includes(user.role);

    // Coaches see all client check-ins; users see their own
    const checkIns = isCoach
        ? await prisma.checkIn.findMany({
            where: { user: { coachId: user.id } },
            include: { user: { select: { name: true, email: true, avatarUrl: true } } },
            orderBy: { createdAt: "desc" },
        })
        : await prisma.checkIn.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
        });

    return (
        <>
            <TopBar title={isCoach ? "Clinical Review" : "My Progress"} subtitle={isCoach ? "Professional client management" : "Track your weekly athletic performance"} />
            <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
                <CheckInsClient
                    checkIns={checkIns.map((c: any) => ({
                        id: c.id,
                        createdAt: c.createdAt.toISOString(),
                        weekNumber: c.weekNumber,
                        bodyweightKg: c.bodyweightKg,
                        feedback: c.feedback,
                        notes: c.notes,
                        videoUrl: c.videoUrl,
                        status: c.status,
                        coachResponse: c.coachResponse,
                        respondedAt: c.respondedAt?.toISOString() || null,
                        userName: c.user?.name ?? null,
                        sleepRating: c.sleepRating,
                        dietRating: c.dietRating,
                        stressRating: c.stressRating,
                        injuryRating: c.injuryRating,
                        user: c.user ? { id: c.userId, name: c.user.name, email: c.user.email } : undefined,
                    }))}
                    isCoach={isCoach}
                    userRole={user.role}
                />
            </div>
        </>
    );
}
