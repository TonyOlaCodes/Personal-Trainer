/**
 * Presence vs workout state — regression checks (no DB).
 * Run: npx tsx scripts/test-presence-workout.ts
 */
import assert from "node:assert/strict";
import {
    ONLINE_THRESHOLD_MS,
    formatPresenceWithWorkout,
    getPresenceIndicator,
    isOnlineNow,
} from "../src/lib/userPresence";

function ago(ms: number) {
    return new Date(Date.now() - ms).toISOString();
}

console.log("\nPresence / workout separation\n");

assert.equal(isOnlineNow(ago(60_000)), true, "1m ago → online");
assert.equal(isOnlineNow(ago(ONLINE_THRESHOLD_MS - 1)), true, "just under 5m → online");
assert.equal(isOnlineNow(ago(ONLINE_THRESHOLD_MS + 1_000)), false, "over 5m → offline");
assert.equal(isOnlineNow(ago(4 * 60 * 60 * 1000)), false, "4h ago → offline");
assert.equal(isOnlineNow(null), false, "null → offline");

const online = getPresenceIndicator(ago(30_000));
assert.equal(online.level, "online");
assert.match(online.dotClassName, /success/);

const offline = getPresenceIndicator(ago(30 * 60 * 1000));
assert.notEqual(offline.level, "online");
assert.doesNotMatch(offline.dotClassName, /success/);

assert.equal(
    formatPresenceWithWorkout(ago(30_000), "Upper A"),
    "Online · Workout in progress · Upper A"
);
assert.equal(
    formatPresenceWithWorkout(ago(60 * 60 * 1000), "Upper A"),
    "Offline · Workout in progress · Upper A"
);
assert.equal(
    formatPresenceWithWorkout(ago(60 * 60 * 1000), null),
    formatPresenceWithWorkout(ago(60 * 60 * 1000))
);

// Critical: abandoned workout must not flip presence to online
const abandoned = getPresenceIndicator(ago(3 * 60 * 60 * 1000));
assert.notEqual(abandoned.level, "online", "3h idle stays offline even if workout exists elsewhere");
assert.ok(
    formatPresenceWithWorkout(ago(3 * 60 * 60 * 1000), "Legs").startsWith("Offline"),
    "workout label still Offline when lastActive is stale"
);

console.log("  ✓ online threshold 5 minutes");
console.log("  ✓ workout does not force Online");
console.log("  ✓ Offline · Workout in progress when idle");
console.log("  ✓ Online · Workout in progress when active");
console.log("\nAll presence checks passed\n");
