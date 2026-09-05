/**
 * Live cross-check of chat filter flags vs canonical due/missed helpers.
 * Run: npx tsx --env-file=.env scripts/verify-chat-filters-live.ts
 */
import { getCoachClientFilterFlags } from "../src/lib/chatConversationMeta";
import { getEffectiveCheckInDueStatesForUsers } from "../src/lib/coachAttentionActions";
import { isCoachClientCheckInDueForFilter } from "../src/lib/coachOverdueCheckIns";
import { getCoachPauseStatusMap } from "../src/lib/coachClientPause";
import { getActiveSessionsForClients } from "../src/lib/coachChat";
import { getUnreadCountsByPeer } from "../src/lib/chatUnread";
import { getLastActiveMap, isOnlineNow } from "../src/lib/userPresence";
import { prisma } from "../src/lib/prisma";
import { isInactiveAccount } from "../src/lib/userDeactivation";

async function main() {
    const coach = await prisma.user.findFirst({
        where: { role: { in: ["COACH", "SUPER_ADMIN"] }, isDeleted: false },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { role: "asc" },
    });
    if (!coach) {
        console.log("No coach found.");
        return;
    }

    const clients = await prisma.user.findMany({
        where: { coachId: coach.id, isDeleted: false, isDeactivated: false },
        select: {
            id: true,
            name: true,
            email: true,
            isDeleted: true,
            isDeactivated: true,
        },
        orderBy: { name: "asc" },
    });

    const clientIds = clients.map((c) => c.id);
    const [flags, dueStates, pauseMap, sessions, unread, presence] = await Promise.all([
        getCoachClientFilterFlags(clientIds, coach.id),
        getEffectiveCheckInDueStatesForUsers(clientIds),
        getCoachPauseStatusMap(clientIds),
        getActiveSessionsForClients(clientIds),
        getUnreadCountsByPeer(coach.id, clientIds),
        getLastActiveMap(clientIds),
    ]);

    console.log(`Coach: ${coach.name ?? coach.email} (${coach.role}) · ${clients.length} clients\n`);

    const rows = clients.map((client) => {
        const dueState = dueStates.get(client.id);
        const pause = pauseMap.get(client.id);
        const expectedDue = dueState
            ? isCoachClientCheckInDueForFilter(dueState, {
                isCoachPaused: pause?.isCoachPaused ?? false,
                coachResumedAt: pause?.coachResumedAt ?? null,
            })
            : false;
        const flag = flags[client.id] ?? { checkInDue: false, missedWorkout: false };
        return {
            name: client.name ?? client.email ?? client.id,
            paused: Boolean(pause?.isCoachPaused) || isInactiveAccount(client),
            unread: unread[client.id] ?? 0,
            online: isOnlineNow(presence[client.id]),
            inWorkout: Boolean(sessions[client.id]),
            missed: flag.missedWorkout,
            checkInDue: flag.checkInDue,
            expectedDue,
            dueToday: Boolean(dueState?.isDueToday),
            overdue: Boolean(dueState?.isOverdue),
            mismatch: flag.checkInDue !== expectedDue,
        };
    });

    const mismatches = rows.filter((row) => row.mismatch);
    const dueRows = rows.filter((row) => row.checkInDue);
    const missedRows = rows.filter((row) => row.missed);
    const unreadRows = rows.filter((row) => row.unread > 0);
    const onlineRows = rows.filter((row) => row.online);
    const offlineRows = rows.filter((row) => !row.online);
    const inWorkoutRows = rows.filter((row) => row.inWorkout);
    const pausedRows = rows.filter((row) => row.paused);

    console.log(`UNREAD: ${unreadRows.length} · ONLINE: ${onlineRows.length} · OFFLINE: ${offlineRows.length}`);
    console.log(`IN WORKOUT: ${inWorkoutRows.length} · MISSED: ${missedRows.length} · CHECK-IN DUE: ${dueRows.length}`);
    console.log(`PAUSED/INACTIVE: ${pausedRows.length}`);

    if (dueRows.length > 0) {
        console.log("\nCheck-in due:");
        for (const row of dueRows) {
            console.log(`  - ${row.name} (${row.overdue ? "overdue" : row.dueToday ? "due today" : "flagged"})`);
        }
    }
    if (missedRows.length > 0) {
        console.log("\nMissed workout:");
        for (const row of missedRows) console.log(`  - ${row.name}`);
    }
    if (inWorkoutRows.length > 0) {
        console.log("\nIn workout:");
        for (const row of inWorkoutRows) console.log(`  - ${row.name}`);
    }
    if (pausedRows.length > 0) {
        console.log("\nPaused/inactive (should not be due/missed):");
        for (const row of pausedRows) {
            console.log(`  - ${row.name} due=${row.checkInDue} missed=${row.missed}`);
        }
    }

    if (mismatches.length > 0) {
        console.error("\nCHECK-IN DUE mismatches vs getEffectiveCheckInDueState:");
        for (const row of mismatches) {
            console.error(`  - ${row.name}: flag=${row.checkInDue} expected=${row.expectedDue}`);
        }
        process.exitCode = 1;
        return;
    }

    console.log("\nCheck-in due flags match getEffectiveCheckInDueStateForUser / isCoachClientCheckInDueForFilter.");
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
