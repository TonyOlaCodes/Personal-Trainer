import { prisma } from "@/lib/prisma";
import { getLocalDayBounds } from "@/lib/utils";

/** Remove IN_PROGRESS drafts when the same workout was already completed that day. */
export async function cleanupStaleInProgressSessions(userId: string) {
    const inProgressLogs = await prisma.workoutLog.findMany({
        where: { userId, status: "IN_PROGRESS" },
        select: { id: true, workoutId: true, loggedAt: true },
    });

    for (const draft of inProgressLogs) {
        const { start, end } = getLocalDayBounds(draft.loggedAt);
        const completed = await prisma.workoutLog.findFirst({
            where: {
                userId,
                workoutId: draft.workoutId,
                status: "COMPLETED",
                loggedAt: { gte: start, lte: end },
            },
            select: { id: true },
        });

        if (completed) {
            await prisma.workoutLog.delete({ where: { id: draft.id } });
        }
    }
}
