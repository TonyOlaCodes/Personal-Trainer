import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChatClient } from "./ChatClient";

export const metadata = { title: "Chat" };

export default async function ChatPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) redirect("/sign-in");

    // Build conversation list:
    // For clients → their coach
    // For coaches → their clients
    // For admin → all coaches + clients
    let conversations: { userId: string; name: string; role: string; avatarUrl: string | null }[] = [];

    if (user.role === "PREMIUM") {
        // Show coach if assigned
        if (user.coachId) {
            const coach = await prisma.user.findUnique({
                where: { id: user.coachId },
                select: { id: true, name: true, role: true, avatarUrl: true },
            });
            if (coach) conversations = [{ userId: coach.id, name: coach.name ?? "Coach", role: coach.role, avatarUrl: coach.avatarUrl }];
        }
    } else if (["COACH", "SUPER_ADMIN"].includes(user.role)) {
        const clients = await prisma.user.findMany({
            where: { coachId: user.id },
            select: { id: true, name: true, role: true, avatarUrl: true },
        });
        conversations = clients.map((c) => ({
            userId: c.id,
            name: c.name ?? "Client",
            role: c.role,
            avatarUrl: c.avatarUrl,
        }));
    }

    return (
        <ChatClient
            currentUserId={user.id}
            currentUserRole={user.role}
            conversations={conversations}
        />
    );
}
