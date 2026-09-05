/**
 * Canonical calendar session for a date.
 *
 * Past due sessions are owned by frozen history (or a completed / in-progress log).
 * Live plan regeneration may change today and the future only.
 */
export function pickCalendarScheduledSession<T>(input: {
    dateKey: string;
    todayKey: string;
    completed: T | null;
    inProgress?: T | null;
    historical: T | null;
    live: T | null;
}): T | null {
    if (input.dateKey > input.todayKey) {
        return input.live;
    }

    if (input.completed) return input.completed;
    if (input.inProgress) return input.inProgress;

    if (input.dateKey < input.todayKey && input.historical) {
        return input.historical;
    }

    return input.live ?? input.historical;
}

/** Inclusive window of already-due dates for one plan assignment. Never includes today or future. */
export function historicalAssignmentWindow(
    startedKey: string,
    nextAssignmentStartKey: string | null,
    yesterdayKey: string
): { fromKey: string; toKey: string } | null {
    let toKey = yesterdayKey;
    if (nextAssignmentStartKey) {
        const lastDay = addDaysToDateKey(nextAssignmentStartKey, -1);
        if (lastDay < toKey) toKey = lastDay;
    }
    if (startedKey > toKey) return null;
    return { fromKey: startedKey, toKey };
}

/**
 * When startedAt was reset forward on an existing assignment, recover the
 * earlier dates this row already covered — stopping before any other plan started.
 */
export function priorResetAssignmentWindow(
    createdKey: string,
    startedKey: string,
    otherAssignmentStartKeys: string[],
    yesterdayKey: string
): { fromKey: string; toKey: string } | null {
    if (createdKey >= startedKey) return null;
    let toKey = addDaysToDateKey(startedKey, -1);
    for (const otherStart of otherAssignmentStartKeys) {
        if (otherStart > createdKey && otherStart <= startedKey) {
            const dayBefore = addDaysToDateKey(otherStart, -1);
            if (dayBefore < toKey) toKey = dayBefore;
        }
    }
    if (toKey > yesterdayKey) toKey = yesterdayKey;
    if (createdKey > toKey) return null;
    return { fromKey: createdKey, toKey };
}

export function addDaysToDateKey(dateKey: string, days: number): string {
    const [y, m, d] = dateKey.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
