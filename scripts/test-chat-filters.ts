/**
 * Coach chat conversation filters (no DB).
 * Run: npm run test:chat-filters
 */
import assert from "node:assert/strict";
import {
    coachConversationEmptyMessage,
    conversationMatchesCoachFilters,
} from "../src/lib/chatConversationFilters";
import {
    clearOutstandingCheckInPeriod,
    finalizeEffectiveCheckInDueState,
} from "../src/lib/coachAttentionActions";
import {
    hasGenuineMissedScheduledWorkout,
    logSlotKey,
} from "../src/lib/coachMissedScheduledWorkouts";
import {
    isCoachClientCheckInAttentionNeeded,
    isCoachClientCheckInDueForFilter,
} from "../src/lib/coachOverdueCheckIns";
import { canonicalPeriodDueDateKey, getCheckInDueState, type CheckInSchedule } from "../src/lib/checkInSchedule";
import type { ActiveUserPlanLike } from "../src/lib/planSchedule";
import { parseLogDate } from "../src/lib/utils";
import { isOnlineNow } from "../src/lib/userPresence";

let passed = 0;
function check(name: string, fn: () => void) {
    try {
        fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (err) {
        console.error(`  ✗ ${name}`);
        throw err;
    }
}

const repeatingPlan: ActiveUserPlanLike = {
    startedAt: new Date("2026-08-03T12:00:00Z"),
    plan: {
        weeks: [{
            weekNumber: 1,
            workouts: [
                { id: "mon", name: "Upper", dayNumber: 1, dayOfWeek: 0, exercises: [{ id: "e1" }] },
                { id: "tue", name: "Lower", dayNumber: 2, dayOfWeek: 1, exercises: [{ id: "e2" }] },
                { id: "wed", name: "Push", dayNumber: 3, dayOfWeek: 2, exercises: [{ id: "e3" }] },
                { id: "thu", name: "Pull", dayNumber: 4, dayOfWeek: 3, exercises: [{ id: "e4" }] },
                { id: "fri", name: "Legs", dayNumber: 5, dayOfWeek: 4, exercises: [{ id: "e5" }] },
                { id: "sat", name: "Rest", dayNumber: 6, dayOfWeek: 5, exercises: [] },
                { id: "sun", name: "Rest", dayNumber: 7, dayOfWeek: 6, exercises: [] },
            ],
        }],
    },
};

const saturday = parseLogDate("2026-09-05");
const saturdayKey = "2026-09-05";

function missedInput(overrides: Partial<Parameters<typeof hasGenuineMissedScheduledWorkout>[0]> = {}) {
    return {
        today: saturday,
        todayKey: saturdayKey,
        activeUserPlan: repeatingPlan,
        completedLogKeys: new Set<string>(),
        inProgressLogKeys: new Set<string>(),
        excusedKeys: new Set<string>(),
        pauseClient: { isCoachPaused: false, coachResumedAt: null },
        ...overrides,
    };
}

console.log("\nCoach chat filters\n");

check("UNREAD uses the real unread count only", () => {
    assert.equal(conversationMatchesCoachFilters({
        name: "Alex",
        search: "",
        filters: ["unread"],
        unreadCount: 2,
        isOnline: false,
        inWorkout: false,
        missedWorkout: false,
        checkInDue: false,
    }), true);
    assert.equal(conversationMatchesCoachFilters({
        name: "Alex",
        search: "",
        filters: ["unread"],
        unreadCount: 0,
        isOnline: true,
        inWorkout: true,
        missedWorkout: true,
        checkInDue: true,
    }), false);
});

check("ONLINE is presence-only and ignores an active workout", () => {
    assert.equal(isOnlineNow(new Date(Date.now() - 60_000)), true);
    assert.equal(isOnlineNow(new Date(Date.now() - 10 * 60_000)), false);
    assert.equal(conversationMatchesCoachFilters({
        name: "Alex",
        search: "",
        filters: ["online"],
        unreadCount: 0,
        isOnline: false,
        inWorkout: true,
        missedWorkout: false,
        checkInDue: false,
    }), false);
    assert.equal(conversationMatchesCoachFilters({
        name: "Alex",
        search: "",
        filters: ["online"],
        unreadCount: 0,
        isOnline: true,
        inWorkout: false,
        missedWorkout: false,
        checkInDue: false,
    }), true);
});

check("IN WORKOUT is independent of online presence", () => {
    assert.equal(conversationMatchesCoachFilters({
        name: "Alex",
        search: "",
        filters: ["inWorkout"],
        unreadCount: 0,
        isOnline: false,
        inWorkout: true,
        missedWorkout: false,
        checkInDue: false,
    }), true);
    assert.equal(conversationMatchesCoachFilters({
        name: "Alex",
        search: "",
        filters: ["inWorkout"],
        unreadCount: 0,
        isOnline: true,
        inWorkout: false,
        missedWorkout: false,
        checkInDue: false,
    }), false);
});

check("multiple chips are AND, not OR", () => {
    assert.equal(conversationMatchesCoachFilters({
        name: "Alex",
        search: "",
        filters: ["online", "checkInDue"],
        unreadCount: 0,
        isOnline: true,
        inWorkout: false,
        missedWorkout: false,
        checkInDue: true,
    }), true);
    assert.equal(conversationMatchesCoachFilters({
        name: "Alex",
        search: "",
        filters: ["online", "checkInDue"],
        unreadCount: 0,
        isOnline: true,
        inWorkout: false,
        missedWorkout: false,
        checkInDue: false,
    }), false);
});

check("search and chips apply together on the full list", () => {
    assert.equal(conversationMatchesCoachFilters({
        name: "Alex Stone",
        email: "alex@example.com",
        search: "alex",
        filters: ["checkInDue"],
        unreadCount: 0,
        isOnline: false,
        inWorkout: false,
        missedWorkout: false,
        checkInDue: true,
    }), true);
    assert.equal(conversationMatchesCoachFilters({
        name: "Alex Stone",
        email: "alex@example.com",
        search: "jordan",
        filters: ["checkInDue"],
        unreadCount: 0,
        isOnline: false,
        inWorkout: false,
        missedWorkout: false,
        checkInDue: true,
    }), false);
    assert.equal(conversationMatchesCoachFilters({
        name: "Alex Stone",
        email: "alex@example.com",
        search: "alex",
        filters: ["checkInDue"],
        unreadCount: 0,
        isOnline: false,
        inWorkout: false,
        missedWorkout: false,
        checkInDue: false,
    }), false);
});

check("empty states distinguish filter, search, and no conversations", () => {
    assert.equal(coachConversationEmptyMessage({
        hasSearch: false,
        filterCount: 1,
        hasAnyConversations: true,
    }), "No conversations match this filter");
    assert.equal(coachConversationEmptyMessage({
        hasSearch: false,
        filterCount: 2,
        hasAnyConversations: true,
    }), "No conversations match these filters");
    assert.equal(coachConversationEmptyMessage({
        hasSearch: true,
        filterCount: 1,
        hasAnyConversations: true,
    }), "No conversations match your search or filters.");
    assert.equal(coachConversationEmptyMessage({
        hasSearch: false,
        filterCount: 0,
        hasAnyConversations: false,
    }), "No conversations yet");
});

check("MISSED WORKOUT uses scheduled status, not any past date", () => {
    const weekCompleted = new Set([
        logSlotKey("2026-09-04", "fri"),
        logSlotKey("2026-09-03", "thu"),
        logSlotKey("2026-09-02", "wed"),
        logSlotKey("2026-09-01", "tue"),
        logSlotKey("2026-08-31", "mon"),
    ]);
    assert.equal(hasGenuineMissedScheduledWorkout(missedInput()), true, "unlogged Friday is missed");
    assert.equal(hasGenuineMissedScheduledWorkout(missedInput({
        completedLogKeys: weekCompleted,
    })), false, "completed scheduled days are not missed");
    assert.equal(hasGenuineMissedScheduledWorkout(missedInput({
        inProgressLogKeys: new Set([logSlotKey("2026-09-04", "fri")]),
        completedLogKeys: new Set([
            logSlotKey("2026-09-03", "thu"),
            logSlotKey("2026-09-02", "wed"),
            logSlotKey("2026-09-01", "tue"),
            logSlotKey("2026-08-31", "mon"),
        ]),
    })), false, "in-progress Friday is not missed");
    assert.equal(hasGenuineMissedScheduledWorkout(missedInput({
        excusedKeys: new Set([logSlotKey("2026-09-04", "fri")]),
        completedLogKeys: new Set([
            logSlotKey("2026-09-03", "thu"),
            logSlotKey("2026-09-02", "wed"),
            logSlotKey("2026-09-01", "tue"),
            logSlotKey("2026-08-31", "mon"),
        ]),
    })), false, "excused Friday is not missed");
});

check("paused clients do not surface as missed", () => {
    assert.equal(hasGenuineMissedScheduledWorkout(missedInput({
        pauseClient: { isCoachPaused: true, coachResumedAt: null },
    })), false);
});

check("CHECK-IN DUE uses due today or overdue after a covering submission is cleared", () => {
    const weeklySaturday: CheckInSchedule = {
        day: 6,
        frequencyWeeks: 1,
        startDate: "2026-08-01",
    };
    const dueToday = getCheckInDueState(weeklySaturday, saturday);
    assert.equal(dueToday.isDueToday, true);
    assert.equal(isCoachClientCheckInAttentionNeeded(dueToday, false), true);
    assert.equal(isCoachClientCheckInDueForFilter(dueToday, { isCoachPaused: false }), true);

    const completed = finalizeEffectiveCheckInDueState(
        dueToday,
        [],
        "client-1",
        saturday,
        new Date(),
        true
    );
    assert.equal(completed.isDueToday, false);
    assert.equal(completed.isOverdue, false);
    assert.equal(isCoachClientCheckInDueForFilter(completed, { isCoachPaused: false }), false);

    const overdueDay = parseLogDate("2026-09-07");
    const overdue = getCheckInDueState(weeklySaturday, overdueDay);
    assert.equal(overdue.isOverdue, true);
    assert.equal(isCoachClientCheckInDueForFilter(overdue, { isCoachPaused: false }), true);
    assert.equal(isCoachClientCheckInDueForFilter(overdue, { isCoachPaused: true }), false);

    const dismissed = clearOutstandingCheckInPeriod(overdue, overdueDay);
    assert.equal(isCoachClientCheckInDueForFilter(dismissed, { isCoachPaused: false }), false);
});

check("periodDueDateKey is YYYY-MM-DD in Europe/Dublin, never a raw ISO timestamp", () => {
    const weeklySaturday: CheckInSchedule = {
        day: 6,
        frequencyWeeks: 1,
        startDate: "2026-08-01",
    };
    const dueToday = getCheckInDueState(weeklySaturday, saturday);
    assert.match(dueToday.currentPeriodDueDate ?? "", /T/);
    const key = canonicalPeriodDueDateKey(dueToday.currentPeriodDueDate);
    assert.equal(key, "2026-09-05");
    assert.equal(canonicalPeriodDueDateKey("2026-09-05T12:00:00.000Z"), "2026-09-05");
    assert.equal(canonicalPeriodDueDateKey("2026-09-05"), "2026-09-05");
    assert.equal(canonicalPeriodDueDateKey(null), null);
});

console.log(`\n${passed} passed\n`);
