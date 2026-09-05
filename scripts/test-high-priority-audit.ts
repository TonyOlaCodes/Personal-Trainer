/**
 * Focused H1–H10 high-priority audit tests (no DB).
 * Run: npm run test:high-priority-audit
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
    bodyweightGoalProgressPercent,
    isBodyweightTowardGoal,
    loggedBodyweightPoints,
    resolveWeightGoalDirection,
} from "../src/lib/bodyweightGoalProgress";
import { computePeriodBodyweightStats } from "../src/lib/coachClientPeriodStats";
import { authorizeCronRequest } from "../src/lib/cronAuth";
import { trainingHistoryAchievementSyncTargets } from "../src/lib/achievementSyncTargets";
import {
    coachMissedCheckInEntityId,
    coachMissedWorkoutEntityId,
    shouldQueueCoachMissedNotification,
} from "../src/lib/scheduledCoachNotifications";
import { decideAttachUploadOwnership } from "../src/lib/uploadAttachOwnership";
import { lifestyleGoalDistance } from "../src/lib/lifestyleDashboardVisibility";

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

console.log("\nHigh-priority audit H1–H10\n");

check("H2: unlogged lifestyle stays neutral", () => {
    assert.equal(lifestyleGoalDistance("calories", null, 2000), null);
    assert.equal(lifestyleGoalDistance("steps", undefined, 8000), null);
});

check("H2: logged below / reached / exceeded / real 0", () => {
    assert.equal(lifestyleGoalDistance("calories", 1700, 2000)?.status, "below");
    assert.equal(lifestyleGoalDistance("calories", 2000, 2000)?.text, "Goal reached");
    assert.equal(lifestyleGoalDistance("calories", 2500, 2000)?.text, "Goal reached");
    assert.equal(lifestyleGoalDistance("calories", 0, 2000)?.status, "below");
    assert.equal(lifestyleGoalDistance("calories", null, 2000), null);
});

check("H3: missing bodyweight is not converted to 0", () => {
    const rows = loggedBodyweightPoints([
        { date: "2026-08-01", weight: null },
        { date: "2026-08-02", weight: 77 },
        { date: "2026-08-03", weightKg: undefined },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].weight, 77);
});

check("H3: chart/average excludes missing dates", () => {
    const stats = computePeriodBodyweightStats(
        [
            { date: "2026-08-02", weightKg: 77 },
            { date: "2026-08-10", weightKg: 76 },
        ],
        "2026-08-01",
        "2026-08-31"
    );
    assert.equal(stats.entries, 2);
    assert.equal(stats.averageKg, 76.5);
    assert.equal(stats.currentKg, 76);
    const empty = computePeriodBodyweightStats([], "2026-08-01", "2026-08-31");
    assert.equal(empty.currentKg, null);
    assert.equal(empty.averageKg, null);
    assert.equal(empty.changeKg, null);
});

check("H4: later global latest does not leak into August", () => {
    const august = computePeriodBodyweightStats(
        [
            { date: "2026-08-12", weightKg: 77 },
            { date: "2026-09-04", weightKg: 78 },
        ],
        "2026-08-01",
        "2026-08-31",
        78
    );
    assert.equal(august.currentKg, 77);
});

check("H5: gaining / losing / maintaining / wrong direction / exact target", () => {
    assert.equal(resolveWeightGoalDirection(70, 80), "GAINING");
    assert.equal(resolveWeightGoalDirection(100, 90), "LOSING");
    assert.equal(resolveWeightGoalDirection(75, 75.1), "MAINTAINING");
    assert.equal(bodyweightGoalProgressPercent(70, 75, 80), 50);
    assert.equal(bodyweightGoalProgressPercent(100, 95, 90), 50);
    assert.equal(bodyweightGoalProgressPercent(70, 80, 80), 100);
    assert.equal(bodyweightGoalProgressPercent(70, 65, 80), 0);
    assert.equal(bodyweightGoalProgressPercent(100, 105, 90), 0);
    assert.equal(isBodyweightTowardGoal({ baselineKg: 70, currentKg: 75, targetKg: 80 }), true);
    assert.equal(isBodyweightTowardGoal({ baselineKg: 70, currentKg: 65, targetKg: 80 }), false);
});

check("H6: delete/excuse syncs the client once, not only the coach", () => {
    assert.deepEqual(
        trainingHistoryAchievementSyncTargets({ subjectUserId: "client-1", coachId: "coach-1" }),
        ["client-1", "coach-1"]
    );
    assert.deepEqual(
        trainingHistoryAchievementSyncTargets({ subjectUserId: "client-1", coachId: "client-1" }),
        ["client-1"]
    );
});

check("H7: schema and migration include runtime tables", () => {
    const schema = readFileSync(resolve("prisma/schema.prisma"), "utf8");
    const migration = resolve("prisma/migrations/20260905120000_high_priority_runtime_tables/migration.sql");
    assert.ok(existsSync(migration));
    const sql = readFileSync(migration, "utf8");
    for (const model of ["BodyweightLog", "DailyMetricLog", "PendingCoachNotification", "CoachAttentionAction", "MediaAsset", "CheckInRequest"]) {
        assert.ok(schema.includes(`model ${model}`), `schema missing ${model}`);
    }
    for (const table of ["bodyweight_logs", "daily_metric_logs", "pending_coach_notifications", "coach_attention_actions", "media_assets", "check_in_requests"]) {
        assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS "${table}"`), `migration missing ${table}`);
    }
});

check("H8: cron secret valid / invalid / missing is denied", () => {
    const previousSecret = process.env.CRON_SECRET;
    const previousNode = process.env.NODE_ENV;
    const previousVercel = process.env.VERCEL;
    try {
        delete process.env.VERCEL;
        process.env.NODE_ENV = "production";
        delete process.env.CRON_SECRET;
        assert.equal(authorizeCronRequest(new Request("https://example.com/api/cron", {
            headers: { authorization: "Bearer anything" },
        })), false);

        process.env.CRON_SECRET = "correct-secret";
        assert.equal(authorizeCronRequest(new Request("https://example.com/api/cron", {
            headers: { authorization: "Bearer wrong" },
        })), false);
        assert.equal(authorizeCronRequest(new Request("https://example.com/api/cron", {
            headers: { authorization: "Bearer correct-secret" },
        })), true);
    } finally {
        if (previousSecret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previousSecret;
        if (previousNode === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNode;
        if (previousVercel === undefined) delete process.env.VERCEL;
        else process.env.VERCEL = previousVercel;
    }
});

check("H9: scheduled notification identity is stable and resolved conditions do not queue", () => {
    const first = coachMissedCheckInEntityId("client-1", 36, 2026);
    const second = coachMissedCheckInEntityId("client-1", 36, 2026);
    assert.equal(first, second);
    assert.notEqual(first, coachMissedCheckInEntityId("client-1", 36, 2025));
    assert.equal(
        coachMissedWorkoutEntityId("client-1", "2026-09-04", "w1"),
        "client-1:2026-09-04:w1"
    );
    assert.equal(shouldQueueCoachMissedNotification({
        conditionActive: true,
        alreadyQueuedOrSent: false,
        dismissedOrResolved: false,
        clientInactive: false,
        clientPaused: false,
    }), true);
    assert.equal(shouldQueueCoachMissedNotification({
        conditionActive: true,
        alreadyQueuedOrSent: true,
        dismissedOrResolved: false,
        clientInactive: false,
        clientPaused: false,
    }), false);
    assert.equal(shouldQueueCoachMissedNotification({
        conditionActive: false,
        alreadyQueuedOrSent: false,
        dismissedOrResolved: true,
        clientInactive: false,
        clientPaused: false,
    }), false);
});

check("H10: user cannot attach another user's known upload", () => {
    assert.equal(decideAttachUploadOwnership({
        actorId: "user-a",
        ownerUserId: "user-b",
        filename: "photo.webp",
    }).ok, false);
    assert.equal(decideAttachUploadOwnership({
        actorId: "user-a",
        ownerUserId: "user-a",
        filename: "photo.webp",
    }).reason, "owned");
    assert.equal(decideAttachUploadOwnership({
        actorId: "user-a",
        ownerUserId: null,
        filename: "legacy.webp",
    }).reason, "unregistered");
});

console.log(`\n${passed} passed\n`);
