export type CoachListFilter =
    | "unread"
    | "online"
    | "inWorkout"
    | "missedWorkout"
    | "checkInDue";

export const COACH_FILTER_OPTIONS: { id: CoachListFilter; label: string }[] = [
    { id: "unread", label: "Unread" },
    { id: "online", label: "Online" },
    { id: "inWorkout", label: "In workout" },
    { id: "missedWorkout", label: "Missed workout" },
    { id: "checkInDue", label: "Check-in due" },
];

/**
 * Multi-select chips are AND. Search narrows the same full conversation set.
 * Presence, unread, and in-workout are supplied by the caller from their
 * canonical sources — this helper does not infer them.
 */
export function conversationMatchesCoachFilters(input: {
    name: string;
    email?: string | null;
    search: string;
    filters: CoachListFilter[];
    unreadCount: number;
    isOnline: boolean;
    inWorkout: boolean;
    missedWorkout: boolean;
    checkInDue: boolean;
}): boolean {
    const query = input.search.trim().toLowerCase();
    if (query) {
        const haystack = `${input.name} ${input.email ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
    }

    if (input.filters.length === 0) return true;

    return input.filters.every((filter) => {
        switch (filter) {
            case "unread":
                return input.unreadCount > 0;
            case "online":
                return input.isOnline;
            case "inWorkout":
                return input.inWorkout;
            case "missedWorkout":
                return input.missedWorkout;
            case "checkInDue":
                return input.checkInDue;
            default:
                return true;
        }
    });
}

export function coachConversationEmptyMessage(input: {
    hasSearch: boolean;
    filterCount: number;
    hasAnyConversations: boolean;
}): string {
    if (!input.hasAnyConversations) return "No conversations yet";
    if (input.filterCount > 0 && !input.hasSearch) {
        return input.filterCount === 1
            ? "No conversations match this filter"
            : "No conversations match these filters";
    }
    if (input.hasSearch && input.filterCount > 0) {
        return "No conversations match your search or filters.";
    }
    if (input.hasSearch) return "No conversations match your search.";
    return "No conversations yet";
}
