import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DeactivationDb = PrismaClient | Prisma.TransactionClient;

type DeactivationRow = {
    id: string;
    isDeactivated: boolean;
};

type AccountStatusRow = {
    id: string;
    isDeactivated: boolean;
    isDeleted: boolean;
    deletedName: string | null;
    deletedEmail: string | null;
    deletedAt: Date | null;
};

export type UserAccountStatus = Omit<AccountStatusRow, "id">;

export async function ensureUserDeactivationColumn(db: DeactivationDb = prisma) {
    await db.$executeRawUnsafe(
        'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isDeactivated" BOOLEAN NOT NULL DEFAULT false'
    );
}

export async function ensureUserAccountStatusColumns(db: DeactivationDb = prisma) {
    await ensureUserDeactivationColumn(db);
    await db.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false');
    await db.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)');
    await db.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedName" TEXT');
    await db.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedEmail" TEXT');
}

export async function getUserDeactivationStatusByClerkId(clerkId: string, db: DeactivationDb = prisma) {
    await ensureUserDeactivationColumn(db);
    const rows = await db.$queryRawUnsafe<Array<{ isDeactivated: boolean }>>(
        'SELECT "isDeactivated" FROM "users" WHERE "clerkId" = $1 LIMIT 1',
        clerkId
    );
    return rows[0]?.isDeactivated ?? false;
}

export async function getUserDeactivationStatusById(userId: string, db: DeactivationDb = prisma) {
    await ensureUserDeactivationColumn(db);
    const rows = await db.$queryRawUnsafe<Array<{ isDeactivated: boolean }>>(
        'SELECT "isDeactivated" FROM "users" WHERE "id" = $1 LIMIT 1',
        userId
    );
    return rows[0]?.isDeactivated ?? false;
}

export async function getUserDeactivationMap(userIds: string[], db: DeactivationDb = prisma) {
    await ensureUserDeactivationColumn(db);
    if (userIds.length === 0) return new Map<string, boolean>();

    const rows = await db.$queryRaw<DeactivationRow[]>`
        SELECT "id", "isDeactivated"
        FROM "users"
        WHERE "id" IN (${Prisma.join(userIds)})
    `;

    return new Map(rows.map((row) => [row.id, row.isDeactivated]));
}

export async function getUserAccountStatusMap(userIds: string[], db: DeactivationDb = prisma) {
    await ensureUserAccountStatusColumns(db);
    if (userIds.length === 0) return new Map<string, UserAccountStatus>();

    const rows = await db.$queryRaw<AccountStatusRow[]>`
        SELECT "id", "isDeactivated", "isDeleted", "deletedName", "deletedEmail", "deletedAt"
        FROM "users"
        WHERE "id" IN (${Prisma.join(userIds)})
    `;

    return new Map(rows.map(({ id, ...status }) => [id, status]));
}

export async function setUserDeactivationStatus(userId: string, isDeactivated: boolean, db: DeactivationDb = prisma) {
    await ensureUserAccountStatusColumns(db);
    await db.$executeRawUnsafe(
        'UPDATE "users" SET "isDeactivated" = $1 WHERE "id" = $2',
        isDeactivated,
        userId
    );
}

export async function markUserAccountDeleted(
    user: { id: string; name?: string | null; email: string },
    db: DeactivationDb = prisma
) {
    await ensureUserAccountStatusColumns(db);
    await db.$executeRawUnsafe(
        'UPDATE "users" SET "isDeactivated" = true, "isDeleted" = true, "deletedAt" = NOW(), "deletedName" = $1, "deletedEmail" = $2 WHERE "id" = $3',
        user.name ?? null,
        user.email,
        user.id
    );
}
