/** Client counters must recalc after delete/excuse; coach achievements may also change. */
export function trainingHistoryAchievementSyncTargets(input: {
    subjectUserId: string;
    coachId?: string | null;
}): string[] {
    return [...new Set([input.subjectUserId, input.coachId].filter((id): id is string => Boolean(id)))];
}
