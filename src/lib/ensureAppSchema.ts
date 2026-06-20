import { ensureDbSchema } from "@/lib/prisma";
import { ensureBodyweightTable } from "@/lib/bodyweight";
import { ensureCheckInScheduleColumns } from "@/lib/checkInSchedule";
import { ensureDailyMetricsTable, ensureDailyMetricTargetColumns } from "@/lib/dailyMetrics";
import { ensureUserAccountStatusColumns } from "@/lib/userDeactivation";
import { ensureExerciseDictionary } from "@/lib/exerciseDictionary";

let appSchemaReady = false;

export async function ensureAppSchema() {
    if (appSchemaReady) return;

    await Promise.all([
        ensureDbSchema(),
        ensureUserAccountStatusColumns(),
        ensureCheckInScheduleColumns(),
        ensureDailyMetricTargetColumns(),
        ensureDailyMetricsTable(),
        ensureBodyweightTable(),
        ensureExerciseDictionary(),
    ]);

    appSchemaReady = true;
}

export function formatErrorDetails(error: unknown): string {
    if (error instanceof Error) {
        return error.stack || error.message;
    }
    return String(error);
}
