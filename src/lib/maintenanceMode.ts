import { prisma } from "@/lib/prisma";

const MAINTENANCE_MODE_KEY = "maintenance_mode";

let settingsTableReady = false;

export interface MaintenanceModeState {
    enabled: boolean;
    scheduledAt: string | null;
}

export interface MaintenanceModeStatus extends MaintenanceModeState {
    isActive: boolean;
    isScheduled: boolean;
}

export async function ensureAppSettingsTable() {
    if (settingsTableReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "app_settings" (
            "key" TEXT NOT NULL,
            "value" JSONB NOT NULL,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
        )
    `;

    settingsTableReady = true;
}

function normalizeMaintenanceModeValue(value: unknown): MaintenanceModeState {
    if (value === true || value === "true") {
        return { enabled: true, scheduledAt: null };
    }

    if (value === false || value === "false" || value == null) {
        return { enabled: false, scheduledAt: null };
    }

    if (typeof value === "string") {
        try {
            return normalizeMaintenanceModeValue(JSON.parse(value));
        } catch {
            return { enabled: false, scheduledAt: null };
        }
    }

    if (typeof value === "object") {
        const raw = value as { enabled?: unknown; scheduledAt?: unknown };
        const scheduledAt = typeof raw.scheduledAt === "string" && raw.scheduledAt
            ? raw.scheduledAt
            : null;

        return {
            enabled: raw.enabled === true || raw.enabled === "true",
            scheduledAt,
        };
    }

    return { enabled: false, scheduledAt: null };
}

function toMaintenanceStatus(state: MaintenanceModeState, now = new Date()): MaintenanceModeStatus {
    const scheduledTime = state.scheduledAt ? Date.parse(state.scheduledAt) : NaN;
    const hasFutureSchedule = state.enabled && Number.isFinite(scheduledTime) && scheduledTime > now.getTime();

    return {
        ...state,
        isScheduled: hasFutureSchedule,
        isActive: state.enabled && !hasFutureSchedule,
    };
}

export async function getMaintenanceStatus(): Promise<MaintenanceModeStatus> {
    await ensureAppSettingsTable();

    const rows = await prisma.$queryRaw<Array<{ value: unknown }>>`
        SELECT "value"
        FROM "app_settings"
        WHERE "key" = ${MAINTENANCE_MODE_KEY}
        LIMIT 1
    `;

    return toMaintenanceStatus(normalizeMaintenanceModeValue(rows[0]?.value));
}

export async function getMaintenanceMode(): Promise<boolean> {
    const status = await getMaintenanceStatus();
    return status.isActive;
}

export async function setMaintenanceMode(enabled: boolean, scheduledAt: string | null = null) {
    await ensureAppSettingsTable();
    const state: MaintenanceModeState = { enabled, scheduledAt: enabled ? scheduledAt : null };
    const value = JSON.stringify(state);

    await prisma.$executeRaw`
        INSERT INTO "app_settings" ("key", "value", "updatedAt")
        VALUES (${MAINTENANCE_MODE_KEY}, CAST(${value} AS jsonb), CURRENT_TIMESTAMP)
        ON CONFLICT ("key") DO UPDATE
        SET "value" = EXCLUDED."value",
            "updatedAt" = CURRENT_TIMESTAMP
    `;

    return toMaintenanceStatus(state);
}
