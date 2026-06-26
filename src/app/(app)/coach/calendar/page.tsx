import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { CoachCalendarClient } from "./CoachCalendarClient";
import { loadClientCalendarData } from "@/lib/clientCalendarData";

export const metadata = { title: "Client Calendar" };

export default async function CoachCalendarPage({
    searchParams,
}: {
    searchParams: Promise<{ clientId?: string }>;
}) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const coach = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: {
            id: true,
            role: true,
            clients: {
                where: {
                    isDeleted: false,
                    isDeactivated: false,
                    NOT: { email: { endsWith: "@deleted.local" } },
                },
                select: {
                    id: true,
                    name: true,
                    plans: {
                        where: { isActive: true },
                        select: { id: true },
                        take: 1,
                    },
                },
                orderBy: { name: "asc" },
            },
        },
    });

    if (!coach || !["COACH", "SUPER_ADMIN"].includes(coach.role)) {
        redirect("/dashboard");
    }

    const params = await searchParams;
    const clientOptions = coach.clients.map((c) => ({
        id: c.id,
        name: c.name || "Unnamed Client",
        hasActivePlan: c.plans.length > 0,
    }));

    const requestedId = params.clientId;
    const selectedClient =
        clientOptions.find((c) => c.id === requestedId)
        ?? clientOptions.find((c) => c.hasActivePlan)
        ?? clientOptions[0]
        ?? null;

    const calendar = selectedClient
        ? await loadClientCalendarData(selectedClient.id)
        : null;

    return (
        <>
            <TopBar title="Calendar" subtitle="Client training schedules" />
            <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto pb-20">
                <CoachCalendarClient
                    clients={clientOptions}
                    selectedClientId={selectedClient?.id ?? null}
                    selectedClientName={selectedClient?.name ?? "Client"}
                    calendar={calendar}
                />
            </div>
        </>
    );
}
