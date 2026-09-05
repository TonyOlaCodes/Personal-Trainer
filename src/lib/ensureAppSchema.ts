import { ensureDbSchema, prisma } from "@/lib/prisma";
import { ensureBodyweightTable } from "@/lib/bodyweight";
import { ensureCheckInScheduleColumns, ensureCheckInUserWeekUnique, ensureCheckInPeriodDueDateUnique } from "@/lib/checkInSchedule";
import { revokeBlockedAccessCodes } from "@/lib/accessCodes";
import { ensureMediaAssetsTable } from "@/lib/mediaAccess";
import { ensureDailyMetricsTable, ensureDailyMetricTargetColumns } from "@/lib/dailyMetrics";
import { migrateLegacyClientGoals } from "@/lib/clientGoalTargets";
import { ensureWorkoutHistoryIndexes } from "@/lib/workoutHistoryIndexes";
import { ensureUserAccountStatusColumns } from "@/lib/userDeactivation";
import { ensureCoachClientPauseColumns } from "@/lib/coachClientPause";
import { ensureWorkoutSessionOverridesTable } from "@/lib/workoutSessionOverrides";
import { ensureExerciseDictionary } from "@/lib/exerciseDictionary";
import { ensureUnitSystemColumn } from "@/lib/units";
import { ensureNotificationPreferenceColumns, ensureNotificationsTable, ensurePendingCoachNotificationsTable } from "@/lib/notifications";
import { ensurePinnedExercisesColumn } from "@/lib/pinnedExercises";
import { ensureUserProfileColumns } from "@/lib/userProfile";
import { ensureChatTypingTable } from "@/lib/chatTyping";
import { ensureMessageActionColumns } from "@/lib/coachChat";
import { ensureAnnouncementsTable } from "@/lib/announcements";
import { ensurePlanScheduleRevisionsTable } from "@/lib/planScheduleHistory";
import { ensurePlanOriginalCreatorColumn } from "@/lib/planCreator";
import { ensureAccessRequestColumns } from "@/lib/accessRequest";
import { ensureAchievementsTables } from "@/lib/achievements";
import { ensureCoachAttentionActionsTable } from "@/lib/coachAttentionActions";
import { ensureCheckInRequestsTable } from "@/lib/checkInRequests";
import { ensurePlanMissedSessionHistoryTable } from "@/lib/planMissedSessionHistory";
import { ensureGeneralPremiumRole } from "@/lib/ensureGeneralPremiumRole";
import { ensureLogExerciseNotesTable } from "@/lib/logExerciseNotes";
import { ensureLogSetExerciseNamesReady } from "@/lib/logSetExerciseName";
import { ensureLogSetExerciseOrdersReady } from "@/lib/logSetExerciseOrder";
import { ensureUserNicknamesTable } from "@/lib/userNicknames";
import { ensureOnboardingProfileColumns } from "@/lib/onboardingProfile";
import { ensureCoachCodeRequestTables } from "@/lib/coachCodeRequest";
import { ensureAppSettingsTable } from "@/lib/maintenanceMode";
import { ensureExerciseTrackingSchema } from "@/lib/exerciseTracking/ensure";
import { ensureRateLimitTable } from "@/lib/rateLimit";
import { ensureWorkoutLogConcurrencySchema } from "@/lib/workoutLogRevision";
import { ensureCoachClientNotesTable } from "@/lib/coachClientNotes";

let appSchemaReady = false;
let appSchemaPromise: Promise<void> | null = null;

export async function ensureAppSchema() {
    if (appSchemaReady) return;
    if (appSchemaPromise) return appSchemaPromise;

    appSchemaPromise = (async () => {
        await Promise.all([
            ensureDbSchema(),
            ensureUserAccountStatusColumns(),
            ensureCoachClientPauseColumns(),
            ensureWorkoutSessionOverridesTable(),
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
            ensureUserProfileColumns(),
            ensureChatTypingTable(),
            ensureMessageActionColumns(),
            ensureAnnouncementsTable(),
            ensurePlanScheduleRevisionsTable(),
            ensurePlanOriginalCreatorColumn(),
            ensureAccessRequestColumns(),
            ensureAchievementsTables(),
            ensureCoachAttentionActionsTable(),
            ensureCheckInRequestsTable(),
            ensurePlanMissedSessionHistoryTable(),
            ensureGeneralPremiumRole(),
            ensureLogExerciseNotesTable(),
            ensureLogSetExerciseNamesReady(),
            ensureLogSetExerciseOrdersReady(),
            ensureUserNicknamesTable(),
            ensureOnboardingProfileColumns(),
            ensureCoachCodeRequestTables(),
            ensureAppSettingsTable(),
            ensureExerciseTrackingSchema(),
            ensureWorkoutHistoryIndexes(),
            ensureRateLimitTable(),
            ensureWorkoutLogConcurrencySchema(),
            ensureCoachClientNotesTable(),
        ]);
        await ensureCheckInUserWeekUnique();
        await ensureCheckInPeriodDueDateUnique();
        await migrateLegacyClientGoals();
        await ensureMediaAssetsTable();
        await revokeBlockedAccessCodes(prisma);
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
