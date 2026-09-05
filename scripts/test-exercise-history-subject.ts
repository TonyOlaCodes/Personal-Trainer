/**
 * Plan-editor exercise history subject (no DB).
 * Run: npm run test:exercise-history-subject
 */
import assert from "node:assert/strict";
import {
    pickHistorySubjectWithoutPlan,
    pickPlanHistoryAssignee,
    type PlanHistoryAssignment,
} from "../src/lib/exerciseHistorySubject";

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

const tony: PlanHistoryAssignment = {
    userId: "tony",
    isActive: true,
    coachId: "coach",
    isDeleted: false,
    isDeactivated: false,
};
const jane: PlanHistoryAssignment = {
    userId: "jane",
    isActive: true,
    coachId: "coach",
    isDeleted: false,
    isDeactivated: false,
};
const otherCoachClient: PlanHistoryAssignment = {
    userId: "stranger",
    isActive: true,
    coachId: "other-coach",
    isDeleted: false,
    isDeactivated: false,
};

console.log("exercise history subject");

check("assigned plan uses the client, not the coach", () => {
    const pick = pickPlanHistoryAssignee({
        actorId: "coach",
        actorRole: "COACH",
        canLogWorkouts: false,
        assignments: [tony],
    });
    assert.deepEqual(pick, { kind: "user", userId: "tony" });
});

check("switching assigned plans switches the history subject", () => {
    const pick = pickPlanHistoryAssignee({
        actorId: "coach",
        actorRole: "COACH",
        canLogWorkouts: false,
        preferredClientId: "jane",
        assignments: [jane],
    });
    assert.deepEqual(pick, { kind: "user", userId: "jane" });
});

check("coach is not the history subject on an assigned plan", () => {
    const pick = pickPlanHistoryAssignee({
        actorId: "coach",
        actorRole: "COACH",
        canLogWorkouts: false,
        preferredClientId: "coach",
        assignments: [tony],
    });
    assert.deepEqual(pick, { kind: "user", userId: "tony" });
});

check("assignment wins over a URL client who is not on the plan", () => {
    const pick = pickPlanHistoryAssignee({
        actorId: "coach",
        actorRole: "COACH",
        canLogWorkouts: false,
        preferredClientId: "someone-else",
        assignments: [tony],
    });
    assert.deepEqual(pick, { kind: "user", userId: "tony" });
});

check("copied/original creator is ignored — only the current assignee", () => {
    const pick = pickPlanHistoryAssignee({
        actorId: "coach",
        actorRole: "COACH",
        canLogWorkouts: false,
        preferredClientId: "original-creator",
        assignments: [tony],
    });
    assert.deepEqual(pick, { kind: "user", userId: "tony" });
});

check("client editing their own assigned plan uses themselves", () => {
    const pick = pickPlanHistoryAssignee({
        actorId: "tony",
        actorRole: "PREMIUM",
        canLogWorkouts: true,
        assignments: [tony],
    });
    assert.deepEqual(pick, { kind: "user", userId: "tony" });
});

check("SUPER_ADMIN can read an assigned client's history", () => {
    const pick = pickPlanHistoryAssignee({
        actorId: "admin",
        actorRole: "SUPER_ADMIN",
        canLogWorkouts: false,
        assignments: [tony],
    });
    assert.deepEqual(pick, { kind: "user", userId: "tony" });
});

check("unassigned template does not use the coach", () => {
    const pick = pickPlanHistoryAssignee({
        actorId: "coach",
        actorRole: "COACH",
        canLogWorkouts: false,
        assignments: [],
    });
    assert.deepEqual(pick, { kind: "unassigned" });
});

check("unassigned template with a target client uses that client", () => {
    const pick = pickPlanHistoryAssignee({
        actorId: "coach",
        actorRole: "COACH",
        canLogWorkouts: false,
        preferredClientId: "tony",
        assignments: [],
    });
    assert.deepEqual(pick, { kind: "user", userId: "tony" });
});

check("unauthorized coach cannot take another client's assigned history", () => {
    const pick = pickPlanHistoryAssignee({
        actorId: "coach",
        actorRole: "COACH",
        canLogWorkouts: false,
        preferredClientId: "stranger",
        assignments: [otherCoachClient],
    });
    assert.deepEqual(pick, { kind: "forbidden" });
});

check("coach without a clientId is not treated as self", () => {
    const pick = pickHistorySubjectWithoutPlan({
        actorId: "coach",
        canLogWorkouts: false,
    });
    assert.deepEqual(pick, { kind: "unassigned" });
});

check("athlete without a clientId uses their own history", () => {
    const pick = pickHistorySubjectWithoutPlan({
        actorId: "tony",
        canLogWorkouts: true,
    });
    assert.deepEqual(pick, { kind: "user", userId: "tony" });
});

console.log(`\n${passed} checks passed`);
