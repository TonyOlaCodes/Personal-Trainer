import { getActiveWorkoutSession, resumeWorkoutHref } from "@/lib/activeWorkoutSession";
import { ResumeWorkoutBar } from "@/components/shared/ResumeWorkoutBar";

/**
 * Server half of the universal resume bar: reads the one active session from the shared
 * source of truth so the bar can never disagree with Dashboard, Plans or Calendar.
 */
export async function ResumeWorkoutBarSlot({ userId }: { userId: string }) {
    let session: Awaited<ReturnType<typeof getActiveWorkoutSession>> = null;
    try {
        session = await getActiveWorkoutSession(userId);
    } catch (error) {
        // Never let the bar break the whole app shell.
        console.error("[ResumeWorkoutBarSlot] Failed to load active session", error);
        return null;
    }

    if (!session) return null;

    return (
        <ResumeWorkoutBar
            session={{
                id: session.id,
                workoutId: session.workoutId,
                workoutName: session.workoutName,
                dateKey: session.dateKey,
                resumeHref: resumeWorkoutHref(session),
                completedSetCount: session.completedSetCount,
                totalSetCount: session.totalSetCount,
                isBackdated: session.isBackdated,
            }}
        />
    );
}
