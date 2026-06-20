import { ensureDbSchema } from "@/lib/prisma";
import { ensureBodyweightTable } from "@/lib/bodyweight";
import { ensureCheckInScheduleColumns } from "@/lib/checkInSchedule";
import { ensureDailyMetricsTable, ensureDailyMetricTargetColumns } from "@/lib/dailyMetrics";
import { ensureUserAccountStatusColumns } from "@/lib/userDeactivation";

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
    ]);

    appSchemaReady = true;
}

export function formatErrorDetails(error: unknown): string {
    if (error instanceof Error) {
        return error.stack || error.message;
    }
    return String(error);
}
