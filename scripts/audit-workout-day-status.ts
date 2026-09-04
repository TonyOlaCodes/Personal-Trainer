/**
 * Canonical workout-day status matrix.
 *
 * Past scheduled + no completion + no excuse = MISSED (never Rest).
 * Past with no scheduled training = REST.
 * Completed / In Progress / Excused must never be overwritten incorrectly.
 *
 * Run: npm run audit:day-status
 */

import assert from "node:assert/strict";
import {
    isRestPlanWorkout,
    isScheduledTrainingWorkout,
} from "../src/lib/planTrainingTarget";
import {
    resolveWorkoutDayStatus,
    type WorkoutDayStatus,
    type WorkoutDayStatusInput,
} from "../src/lib/workoutDayStatus";

let passed = 0;

function check(label: string, fn: () => void) {
    try {
        fn();
        passed += 1;
        console.log(`  ✓ ${label}`);
    } catch (error) {
        console.error(`  ✗ ${label}`);
        throw error;
    }
}

function status(partial: Partial<WorkoutDayStatusInput>): WorkoutDayStatus {
    return resolveWorkoutDayStatus({
        hasCompletedLog: false,
        hasActiveSession: false,
        hasScheduledTraining: false,
        isPast: false,
        isToday: false,
        isExcused: false,
        ...partial,
    });
}

console.log("isRestPlanWorkout / scheduled training");
check("named Upper with empty exercises is scheduled training (not Rest)", () => {
    const workout = { name: "Upper", exercises: [] };
    assert.equal(isRestPlanWorkout(workout), false);
    assert.equal(isScheduledTrainingWorkout(workout), true);
});

check("explicit Rest name is Rest even with empty exercises", () => {
    assert.equal(isRestPlanWorkout({ name: "Rest", exercises: [] }), true);
    assert.equal(isRestPlanWorkout({ name: "Rest Day", exercises: [] }), true);
    assert.equal(isRestPlanWorkout({ name: "Rest or Repeat Cycle", exercises: [] }), true);
    assert.equal(isScheduledTrainingWorkout({ name: "Rest", exercises: [] }), false);
});

check("unnamed empty slot is Rest", () => {
    assert.equal(isRestPlanWorkout({ name: "", exercises: [] }), true);
    assert.equal(isScheduledTrainingWorkout({ name: "  ", exercises: [] }), false);
});

check("isScheduledTraining flag overrides empty reconstruction", () => {
    const workout = { name: "Upper", exercises: [], isScheduledTraining: true as const };
    assert.equal(isRestPlanWorkout(workout), false);
    assert.equal(isScheduledTrainingWorkout(workout), true);
});

check("historical reconstruction with empty exercises stays training", () => {
    // Mirrors CalendarClient workoutFromHistorical()
    const reconstructed = {
        name: "Upper",
        exercises: [] as { id?: string }[],
        isScheduledTraining: true as const,
    };
    assert.equal(isScheduledTrainingWorkout(reconstructed), true);
    assert.equal(
        status({
            hasScheduledTraining: isScheduledTrainingWorkout(reconstructed),
            isPast: true,
        }),
        "missed"
    );
});

console.log("\nresolveWorkoutDayStatus priority");
check("Scheduled + completed past workout = Completed", () => {
    assert.equal(
        status({
            hasCompletedLog: true,
            hasScheduledTraining: true,
            isPast: true,
        }),
        "completed"
    );
});

check("Scheduled + unfinished active workout = In Progress", () => {
    assert.equal(
        status({
            hasActiveSession: true,
            hasScheduledTraining: true,
            isPast: true,
        }),
        "in-progress"
    );
    assert.equal(
        status({
            hasActiveSession: true,
            hasScheduledTraining: true,
            isToday: true,
        }),
        "in-progress"
    );
});

check("Scheduled + explicitly excused = Excused", () => {
    assert.equal(
        status({
            hasScheduledTraining: true,
            isPast: true,
            isExcused: true,
        }),
        "excused"
    );
});

check("Scheduled + no completion + past date = Missed", () => {
    assert.equal(
        status({
            hasScheduledTraining: true,
            isPast: true,
        }),
        "missed"
    );
});

check("No scheduled workout + past date = Rest Day", () => {
    assert.equal(
        status({
            hasScheduledTraining: false,
            isPast: true,
        }),
        "rest"
    );
});

check("Future scheduled workout = Upcoming", () => {
    assert.equal(
        status({
            hasScheduledTraining: true,
            isPast: false,
            isToday: false,
        }),
        "upcoming"
    );
});

check("Today scheduled (not yet missed) = Today", () => {
    assert.equal(
        status({
            hasScheduledTraining: true,
            isToday: true,
        }),
        "today"
    );
});

check("Completed never becomes Missed after refresh/recalculation", () => {
    const first = status({
        hasCompletedLog: true,
        hasScheduledTraining: true,
        isPast: true,
    });
    const again = status({
        hasCompletedLog: true,
        hasScheduledTraining: true,
        isPast: true,
        isExcused: true, // excuse must not override completed
        hasActiveSession: true, // completed still wins
    });
    assert.equal(first, "completed");
    assert.equal(again, "completed");
});

check("Missed never becomes Rest Day after refresh/recalculation", () => {
    const first = status({
        hasScheduledTraining: true,
        isPast: true,
    });
    // Recalculation with the same scheduled flag must stay missed —
    // including when exercise lists were stripped (historical reconstruction).
    const again = status({
        hasScheduledTraining: isScheduledTrainingWorkout({
            name: "Upper",
            exercises: [],
            isScheduledTraining: true,
        }),
        isPast: true,
    });
    assert.equal(first, "missed");
    assert.equal(again, "missed");
    assert.notEqual(again, "rest");
});

check("In Progress is not overwritten by Missed or Excused", () => {
    assert.equal(
        status({
            hasActiveSession: true,
            hasScheduledTraining: true,
            isPast: true,
            isExcused: true,
        }),
        "in-progress"
    );
});

check("Excused is not overwritten by Missed", () => {
    assert.equal(
        status({
            hasScheduledTraining: true,
            isPast: true,
            isExcused: true,
        }),
        "excused"
    );
});

check("Priority: completed > in-progress > excused > missed > today > upcoming > rest", () => {
    assert.equal(
        status({
            hasCompletedLog: true,
            hasActiveSession: true,
            hasScheduledTraining: true,
            isPast: true,
            isExcused: true,
        }),
        "completed"
    );
    assert.equal(
        status({
            hasActiveSession: true,
            hasScheduledTraining: true,
            isPast: true,
            isExcused: true,
        }),
        "in-progress"
    );
    assert.equal(
        status({
            hasScheduledTraining: true,
            isPast: true,
            isExcused: true,
        }),
        "excused"
    );
    assert.equal(
        status({
            hasScheduledTraining: true,
            isPast: true,
        }),
        "missed"
    );
    assert.equal(
        status({
            hasScheduledTraining: true,
            isToday: true,
        }),
        "today"
    );
    assert.equal(
        status({
            hasScheduledTraining: true,
        }),
        "upcoming"
    );
    assert.equal(status({}), "rest");
});

console.log(`\n${passed} checks passed.`);
