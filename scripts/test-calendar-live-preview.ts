/**
 * Calendar IN_PROGRESS session preview: logged sets, elapsed time, identity.
 * Run: npm run test:calendar-live-preview
 */
import assert from "node:assert/strict";
import {
    belongsToExpectedActiveSession,
    buildLiveExercisePreview,
    countLoggedWorkingSets,
    isLoggedWorkingSet,
    liveElapsedMinutes,
    mapPersistedLogToInProgressPreview,
    pickFresherLivePreview,
} from "../src/lib/calendarLiveSessionPreview";

let passed = 0;
function check(name: string, fn: () => void) {
    try {
        fn();
        passed += 1;
        console.log(`  ✓ ${name}`);
    } catch (err) {
        console.error(`  ✗ ${name}`);
        throw err;
    }
}

check("counts only completed working sets, not placeholders or warmups", () => {
    const sets = [
        { exerciseId: "sq", exerciseName: "Squat", setNumber: 1, isCompleted: true, isWarmup: false },
        { exerciseId: "sq", exerciseName: "Squat", setNumber: 2, isCompleted: false, isWarmup: false, reps: 0 },
        { exerciseId: "sq", exerciseName: "Squat", setNumber: 3, isCompleted: true, isWarmup: true, reps: 10 },
        { exerciseId: "lp", exerciseName: "Leg Press", setNumber: 1, isCompleted: true, isWarmup: false },
    ];
    assert.equal(isLoggedWorkingSet(sets[0]), true);
    assert.equal(isLoggedWorkingSet(sets[1]), false);
    assert.equal(isLoggedWorkingSet(sets[2]), false);
    assert.equal(countLoggedWorkingSets(sets), 2);
});

check("elapsed minutes tick from persisted duration + time since save", () => {
    const updatedAt = new Date("2026-09-05T10:00:00.000Z");
    const now = new Date("2026-09-05T10:02:00.000Z");
    assert.equal(liveElapsedMinutes(40, updatedAt, now), 42);
    assert.equal(liveElapsedMinutes(0, updatedAt, now), 2);
    assert.equal(liveElapsedMinutes(40, updatedAt, updatedAt), 40);
    assert.equal(liveElapsedMinutes(null, null, now), null);
    assert.equal(liveElapsedMinutes(null, updatedAt, now), 2);
});

check("maps persisted active log and rejects completed logs", () => {
    const active = mapPersistedLogToInProgressPreview({
        id: "log-1",
        workoutId: "w-lower",
        loggedAt: "2026-09-05T12:00:00.000Z",
        updatedAt: "2026-09-05T12:40:00.000Z",
        duration: 38,
        status: "IN_PROGRESS",
        workout: { name: "Lower" },
        sets: [
            {
                exerciseId: "sq",
                exerciseName: "Squat",
                exerciseOrder: 0,
                setNumber: 1,
                isCompleted: true,
                isWarmup: false,
            },
            {
                exerciseId: "sq",
                exerciseName: "Squat",
                exerciseOrder: 0,
                setNumber: 2,
                isCompleted: false,
                isWarmup: false,
            },
        ],
    });
    assert.ok(active);
    assert.equal(active.workoutName, "Lower");
    assert.equal(active.workoutId, "w-lower");
    assert.equal(active.duration, 38);
    assert.equal(countLoggedWorkingSets(active.sets), 1);

    assert.equal(
        mapPersistedLogToInProgressPreview({
            id: "log-old",
            workoutId: "w-lower",
            loggedAt: "2026-09-04T12:00:00.000Z",
            status: "COMPLETED",
            workout: { name: "Lower" },
            sets: [],
        }),
        null
    );
});

check("preview uses persisted exercises and overflow copy, not the plan", () => {
    const preview = buildLiveExercisePreview([
        { exerciseId: "a", exerciseName: "Squat", exerciseOrder: 0, setNumber: 1, isCompleted: true },
        { exerciseId: "a", exerciseName: "Squat", exerciseOrder: 0, setNumber: 2, isCompleted: true },
        { exerciseId: "a", exerciseName: "Squat", exerciseOrder: 0, setNumber: 3, isCompleted: true },
        { exerciseId: "b", exerciseName: "Leg Press", exerciseOrder: 1, setNumber: 1, isCompleted: true },
        { exerciseId: "c", exerciseName: "Leg Curl", exerciseOrder: 2, setNumber: 1, isCompleted: true },
        { exerciseId: "d", exerciseName: "Calf Raise", exerciseOrder: 3, setNumber: 1, isCompleted: true },
        { exerciseId: "e", exerciseName: "Lunges", exerciseOrder: 4, setNumber: 1, isCompleted: false },
        { exerciseId: "f", exerciseName: "Hip Thrust", exerciseOrder: 5, setNumber: 1, isCompleted: false },
    ]);
    assert.equal(preview.totalLoggedSets, 6);
    assert.equal(preview.preview.length, 4);
    assert.equal(preview.preview[0].name, "Squat");
    assert.equal(preview.preview[0].loggedSets, 3);
    assert.equal(preview.moreCount, 2);
});

check("identity stays on the scheduled session, not another workout", () => {
    const expected = { id: "log-1", workoutId: "w-lower", date: "2026-09-05" };
    assert.equal(
        belongsToExpectedActiveSession({ workoutId: "w-lower", date: "2026-09-05" }, expected),
        true
    );
    assert.equal(
        belongsToExpectedActiveSession({ workoutId: "w-upper", date: "2026-09-05" }, expected),
        false
    );
    assert.equal(
        belongsToExpectedActiveSession({ workoutId: "w-lower", date: "2026-09-04" }, expected),
        false
    );
});

check("fresher preview wins so a stale calendar payload cannot hide live edits", () => {
    const stale = {
        id: "log-1",
        date: "2026-09-05",
        workoutId: "w-lower",
        workoutName: "Lower",
        duration: 10,
        updatedAt: "2026-09-05T12:10:00.000Z",
        sets: [],
    };
    const live = {
        ...stale,
        duration: 12,
        updatedAt: "2026-09-05T12:12:00.000Z",
        sets: [
            { exerciseId: "added", exerciseName: "Lunges", setNumber: 1, isCompleted: false },
        ],
    };
    const picked = pickFresherLivePreview(stale, live);
    assert.equal(picked.sets.length, 1);
    assert.equal(picked.sets[0].exerciseName, "Lunges");
});

console.log(`\n${passed} calendar live preview checks passed`);
