import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { CalendarClient } from "./CalendarClient";
import { loadClientCalendarData } from "@/lib/clientCalendarData";
import { isCoachRole } from "@/lib/roles";

export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true, role: true },
    });

    if (!user) redirect("/sign-in");

    if (isCoachRole(user.role)) {
        redirect("/coach/calendar");
    }

    const calendar = await loadClientCalendarData(user.id);

    return (
        <>
            <TopBar title="Calendar" subtitle="Your training schedule" />
            <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto pb-20">
                <CalendarClient
                    activePlan={calendar.activePlan}
                    planStartedAt={calendar.planStartedAt}
                    loggedDates={calendar.loggedDates}
                    inProgressSessions={calendar.inProgressSessions}
                />
            </div>
        </>
    );
}
