import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import {
    getMissedWorkoutsYesterdayForCoach,
    getYesterdayDateKey,
} from "@/lib/coachMissedWorkoutsYesterday";
import { MissedWorkoutsClient } from "./MissedWorkoutsClient";
import { APP_TIMEZONE } from "@/lib/appTimezone";

export const metadata = { title: "Missed Workouts" };

export const dynamic = "force-dynamic";

function formatPageDateLabel(dateKey: string): string {
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: APP_TIMEZONE,
        weekday: "long",
        day: "numeric",
        month: "long",
    }).format(date);
}

export default async function CoachMissedWorkoutsPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const coach = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true, role: true },
    });

    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        redirect("/dashboard");
    }

    const missedWorkouts = await getMissedWorkoutsYesterdayForCoach(coach.id);
    const yesterdayKey = getYesterdayDateKey();

    return (
        <>
            <TopBar title="Missed Workouts" subtitle="Yesterday's incomplete sessions" />
            <div className="p-4 sm:p-6 lg:p-10 max-w-3xl mx-auto pb-20">
                <MissedWorkoutsClient
                    missedWorkouts={missedWorkouts}
                    dateLabel={formatPageDateLabel(yesterdayKey)}
                />
            </div>
        </>
    );
}
