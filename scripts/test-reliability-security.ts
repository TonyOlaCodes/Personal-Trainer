/**
 * Reliability / security foundation for auth, rate limits, and workout saves.
 * No database connection — exercises the same helpers the API routes use.
 * Run: npx tsx scripts/test-reliability-security.ts
 */
import assert from "node:assert/strict";
import {
    canAccessAdminApi,
    isAuthorizedCoachForClient,
    resolveActiveUserGate,
} from "../src/lib/apiAuthPolicy";
import {
    consumeRateLimit,
    createMemoryRateLimitStore,
    rateLimitBucket,
    RATE_LIMIT_RULES,
} from "../src/lib/rateLimit";
import {
    acceptWorkoutRevision,
    incomingSetIsMeaningful,
    nextWorkoutRevision,
    shouldApplyInProgressSetReplacement,
    shouldCreateInProgressLog,
    shouldEmitCompletionSideEffects,
} from "../src/lib/workoutSavePolicy";
import { restoreExercisesFromPersistedSets, uniquePersistedExerciseIds } from "../src/lib/activeWorkoutRestore";
import {
    acknowledgeSave,
    enqueueSave,
    rejectStaleSave,
    type SaveQueueState,
} from "../src/lib/workoutSaveQueue";
import { httpErrorMessage } from "../src/lib/httpErrorMessage";

let failed = 0;

async function check(label: string, fn: () => void | Promise<void>) {
    try {
        await fn();
        console.log(`  ✓ ${label}`);
    } catch (error) {
        failed += 1;
        console.error(`  ✗ ${label}`);
        console.error(error);
    }
}

async function main() {
console.log("\nAuthorization\n");

await check("deactivated user cannot pass the active-user gate", () => {
    const gate = resolveActiveUserGate({
        hasClerkSession: true,
        user: { email: "user@example.com", isDeactivated: true },
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) {
        assert.equal(gate.status, 403);
        assert.equal(gate.error, "Account deactivated");
    }
});

await check("deleted user cannot pass the active-user gate", () => {
    const gate = resolveActiveUserGate({
        hasClerkSession: true,
        user: { email: "gone@deleted.local" },
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.status, 403);
});

await check("active signed-in user is allowed", () => {
    const gate = resolveActiveUserGate({
        hasClerkSession: true,
        user: { email: "user@example.com", isDeactivated: false, isDeleted: false },
    });
    assert.equal(gate.ok, true);
});

await check("client cannot access another client's private data", () => {
    assert.equal(
        isAuthorizedCoachForClient({ id: "client-a", role: "PREMIUM" }, "coach-1"),
        false
    );
});

await check("coach can access their own client", () => {
    assert.equal(
        isAuthorizedCoachForClient({ id: "coach-1", role: "COACH" }, "coach-1"),
        true
    );
});

await check("coach cannot access another coach's client", () => {
    assert.equal(
        isAuthorizedCoachForClient({ id: "coach-1", role: "COACH" }, "coach-2"),
        false
    );
});

await check("normal user cannot access admin APIs", () => {
    assert.equal(canAccessAdminApi("PREMIUM"), false);
    assert.equal(canAccessAdminApi("COACH"), false);
    assert.equal(canAccessAdminApi("SUPER_ADMIN"), true);
});

console.log("\nRate limiting\n");

await check("repeated abuse-sensitive requests eventually return 429", async () => {
    const store = createMemoryRateLimitStore();
    const req = new Request("https://tolg.test/api/codes/validate", {
        headers: { "x-forwarded-for": "203.0.113.10" },
    });
    const limit = RATE_LIMIT_RULES.codeValidate.limit;
    for (let i = 0; i < limit; i++) {
        const result = await consumeRateLimit("codeValidate", { userId: "user-1", req }, store, 1_000);
        assert.equal(result.allowed, true);
    }
    const blocked = await consumeRateLimit("codeValidate", { userId: "user-1", req }, store, 1_000);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.count, limit + 1);
});

await check("legitimate normal usage is not immediately blocked", async () => {
    const store = createMemoryRateLimitStore();
    const first = await consumeRateLimit("messageSend", { userId: "user-2" }, store, 1_000);
    assert.equal(first.allowed, true);
    assert.equal(first.count, 1);
});

await check("changing a target client ID does not reset a user's limit", async () => {
    const store = createMemoryRateLimitStore();
    const reqA = new Request("https://tolg.test/api/coach/check-in-requests", {
        method: "POST",
        body: JSON.stringify({ clientId: "client-a" }),
    });
    const reqB = new Request("https://tolg.test/api/coach/check-in-requests", {
        method: "POST",
        body: JSON.stringify({ clientId: "client-b" }),
    });
    assert.equal(
        rateLimitBucket("checkInRequest", "coach-1", reqA),
        rateLimitBucket("checkInRequest", "coach-1", reqB)
    );
    assert.equal(rateLimitBucket("checkInRequest", "coach-1", reqA).includes("client-a"), false);

    const limit = RATE_LIMIT_RULES.checkInRequest.limit;
    for (let i = 0; i < limit; i++) {
        const result = await consumeRateLimit("checkInRequest", { userId: "coach-1", req: reqA }, store, 1_000);
        assert.equal(result.allowed, true);
    }
    const blocked = await consumeRateLimit("checkInRequest", { userId: "coach-1", req: reqB }, store, 1_000);
    assert.equal(blocked.allowed, false);
});

await check("rate-limit errors stay generic", () => {
    assert.equal(
        httpErrorMessage(429, { error: "internal bucket user-1 203.0.113.10" }, "failed"),
        "Too many requests. Try again shortly."
    );
});

console.log("\nWorkout concurrency\n");

await check("newer save is accepted and stale revision 10 cannot overwrite 11", () => {
    const current = 10;
    assert.equal(acceptWorkoutRevision(10, current), true);
    const next = nextWorkoutRevision(current);
    assert.equal(next, 11);
    assert.equal(acceptWorkoutRevision(10, next), false);
    assert.equal(acceptWorkoutRevision(11, next), true);
});

await check("in-flight save plus local change still persists afterward", () => {
    let state: SaveQueueState = { inFlight: false, pending: false, ackedRevision: 10 };
    const first = enqueueSave(state);
    assert.equal(first.sendNow, true);
    state = first.next;

    const whileInFlight = enqueueSave(state);
    assert.equal(whileInFlight.sendNow, false);
    assert.equal(whileInFlight.next.pending, true);
    state = whileInFlight.next;

    const ack = acknowledgeSave(state, 11);
    assert.equal(ack.sendPending, true);
    assert.equal(ack.next.ackedRevision, 11);
    assert.equal(ack.next.inFlight, true);
});

await check("stale rejection still flushes newer local state", () => {
    let state: SaveQueueState = { inFlight: true, pending: true, ackedRevision: 10 };
    const rejected = rejectStaleSave(state, 11);
    assert.equal(rejected.retryPending, true);
    assert.equal(rejected.next.ackedRevision, 11);
});

console.log("\nWorkout completion and start idempotency\n");

await check("second completion does not emit duplicate side effects", () => {
    assert.equal(shouldEmitCompletionSideEffects("IN_PROGRESS", "COMPLETED"), true);
    assert.equal(shouldEmitCompletionSideEffects(null, "COMPLETED"), true);
    assert.equal(shouldEmitCompletionSideEffects("COMPLETED", "COMPLETED"), false);
    assert.equal(shouldEmitCompletionSideEffects("IN_PROGRESS", "IN_PROGRESS"), false);
});

await check("two starts for the same user/session reuse the active draft", () => {
    assert.equal(shouldCreateInProgressLog(null), true);
    assert.equal(shouldCreateInProgressLog("log-already-open"), false);
});

console.log("\nActive workout structure persistence\n");

const planExercises = [
    { id: "ex-a", name: "Bench", order: 0 },
    { id: "ex-b", name: "Squat", order: 1 },
    { id: "ex-c", name: "Row", order: 2 },
];

await check("empty Start payload does not overwrite an existing session", () => {
    assert.equal(
        shouldApplyInProgressSetReplacement({
            incomingHasMeaningfulSets: false,
            expectedRevision: 0,
            incomingExerciseIds: ["ex-a", "ex-b", "ex-c"],
            existingExerciseIds: ["ex-a", "ex-b", "ex-c"],
        }),
        false
    );
});

await check("delete exercise applies even when remaining sets are empty placeholders", () => {
    assert.equal(incomingSetIsMeaningful({ reps: 0, weightKg: 0, isCompleted: false }), false);
    assert.equal(
        shouldApplyInProgressSetReplacement({
            incomingHasMeaningfulSets: false,
            expectedRevision: 1,
            incomingExerciseIds: ["ex-a", "ex-c"],
            existingExerciseIds: ["ex-a", "ex-b", "ex-c"],
        }),
        true
    );
});

await check("stale revision 1 cannot overwrite a newer session after delete", () => {
    assert.equal(acceptWorkoutRevision(1, 2), false);
    assert.equal(acceptWorkoutRevision(2, 2), true);
});

await check("resume keeps only persisted exercise instances", () => {
    const persisted = uniquePersistedExerciseIds([
        { exerciseId: "ex-a" },
        { exerciseId: "ex-a" },
        { exerciseId: "ex-c" },
    ]);
    assert.deepEqual(persisted, ["ex-a", "ex-c"]);
    const restored = restoreExercisesFromPersistedSets(
        [
            { id: "ex-a", name: "Bench", order: 0 },
            { id: "ex-c", name: "Row", order: 2 },
        ],
        planExercises
    );
    assert.deepEqual(restored.map((ex) => ex.id), ["ex-a", "ex-c"]);
    assert.equal(restored.some((ex) => ex.id === "ex-b"), false);
});

await check("deleting one of two same-name instances keeps the other", () => {
    const restored = restoreExercisesFromPersistedSets(
        [{ id: "row-2", name: "Curl", order: 1 }],
        [
            { id: "row-1", name: "Curl", order: 0 },
            { id: "row-2", name: "Curl", order: 1 },
        ]
    );
    assert.deepEqual(restored.map((ex) => ex.id), ["row-2"]);
});

await check("added and swapped exercises resume from persisted IDs, not the plan", () => {
    const restored = restoreExercisesFromPersistedSets(
        [
            { id: "new-lat", name: "Lat Pulldown", order: 0 },
            { id: "ex-a:sub:9k", name: "Incline Press", order: 1 },
        ],
        planExercises
    );
    assert.deepEqual(restored.map((ex) => ex.id), ["new-lat", "ex-a:sub:9k"]);
    assert.equal(restored.some((ex) => ex.id === "ex-a"), false);
});

if (failed > 0) {
    console.error(`\n${failed} reliability check(s) failed\n`);
    process.exit(1);
}

console.log("\nAll reliability/security checks passed\n");
}

void main();
