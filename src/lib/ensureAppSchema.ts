import { ensureDbSchema, prisma } from "@/lib/prisma";
import { ensureBodyweightTable } from "@/lib/bodyweight";
import { ensureCheckInScheduleColumns } from "@/lib/checkInSchedule";
import { ensureDailyMetricsTable, ensureDailyMetricTargetColumns } from "@/lib/dailyMetrics";
import { ensureUserAccountStatusColumns } from "@/lib/userDeactivation";
import { ensureExerciseDictionary } from "@/lib/exerciseDictionary";
import { ensureUnitSystemColumn } from "@/lib/units";
import { ensureNotificationPreferenceColumns, ensureNotificationsTable, ensurePendingCoachNotificationsTable } from "@/lib/notifications";
import { ensurePinnedExercisesColumn } from "@/lib/pinnedExercises";

let appSchemaReady = false;
let appSchemaPromise: Promise<void> | null = null;

export async function ensureAppSchema() {
    if (appSchemaReady) return;
    if (appSchemaPromise) return appSchemaPromise;

    appSchemaPromise = (async () => {
        await Promise.all([
            ensureDbSchema(),
            ensureUserAccountStatusColumns(),
            ensureCheckInScheduleColumns(),
            ensureDailyMetricTargetColumns(),
            ensureDailyMetricsTable(),
            ensureBodyweightTable(),
            ensureExerciseDictionary(),
            ensureUnitSystemColumn(prisma),
            ensureNotificationPreferenceColumns(),
            ensureNotificationsTable(),
            ensurePendingCoachNotificationsTable(),
            ensurePinnedExercisesColumn(),
        ]);
        appSchemaReady = true;
    })();

    try {
        await appSchemaPromise;
    } finally {
        appSchemaPromise = null;
    }
}

export function formatErrorDetails(error: unknown): string {
    if (error instanceof Error) {
        return error.stack || error.message;
    }
    return String(error);
}
