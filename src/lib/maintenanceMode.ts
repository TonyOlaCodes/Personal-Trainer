import { prisma } from "@/lib/prisma";

const MAINTENANCE_MODE_KEY = "maintenance_mode";

let settingsTableReady = false;

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

export async function getMaintenanceMode(): Promise<boolean> {
    await ensureAppSettingsTable();

    const rows = await prisma.$queryRaw<Array<{ value: unknown }>>`
        SELECT "value"
        FROM "app_settings"
        WHERE "key" = ${MAINTENANCE_MODE_KEY}
        LIMIT 1
    `;

    const value = rows[0]?.value;
    return value === true || value === "true";
}

export async function setMaintenanceMode(enabled: boolean) {
    await ensureAppSettingsTable();

    await prisma.$executeRaw`
        INSERT INTO "app_settings" ("key", "value", "updatedAt")
        VALUES (${MAINTENANCE_MODE_KEY}, to_jsonb(${enabled}::boolean), CURRENT_TIMESTAMP)
        ON CONFLICT ("key") DO UPDATE
        SET "value" = EXCLUDED."value",
            "updatedAt" = CURRENT_TIMESTAMP
    `;

    return enabled;
}
