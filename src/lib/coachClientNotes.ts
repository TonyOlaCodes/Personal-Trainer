import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

export interface CoachClientNote {
    id: string;
    clientId: string;
    coachId: string;
    coachName: string | null;
    text: string;
    createdAt: string;
    updatedAt: string;
}

let notesReady = false;

export async function ensureCoachClientNotesTable() {
    if (notesReady) return;

    await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "coach_client_notes" (
            "id" TEXT PRIMARY KEY,
            "clientId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "coachId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "text" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "coach_client_notes_clientId_createdAt_idx"
        ON "coach_client_notes"("clientId", "createdAt" DESC)
    `;
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "coach_client_notes_coachId_idx"
        ON "coach_client_notes"("coachId")
    `;

    notesReady = true;
}

function mapNote(row: {
    id: string;
    clientId: string;
    coachId: string;
    coachName: string | null;
    text: string;
    createdAt: Date;
    updatedAt: Date;
}): CoachClientNote {
    return {
        id: row.id,
        clientId: row.clientId,
        coachId: row.coachId,
        coachName: row.coachName,
        text: row.text,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

export async function listCoachClientNotes(clientId: string): Promise<CoachClientNote[]> {
    await ensureCoachClientNotesTable();
    const rows = await prisma.$queryRaw<Array<{
        id: string;
        clientId: string;
        coachId: string;
        coachName: string | null;
        text: string;
        createdAt: Date;
        updatedAt: Date;
    }>>`
        SELECT
            n."id",
            n."clientId",
            n."coachId",
            u."name" AS "coachName",
            n."text",
            n."createdAt",
            n."updatedAt"
        FROM "coach_client_notes" n
        JOIN "users" u ON u."id" = n."coachId"
        WHERE n."clientId" = ${clientId}
        ORDER BY n."createdAt" DESC
    `;
    return rows.map(mapNote);
}

export async function createCoachClientNote(
    clientId: string,
    coachId: string,
    text: string
): Promise<CoachClientNote> {
    await ensureCoachClientNotesTable();
    const id = randomUUID();
    await prisma.$executeRaw`
        INSERT INTO "coach_client_notes" ("id", "clientId", "coachId", "text")
        VALUES (${id}, ${clientId}, ${coachId}, ${text})
    `;
    const rows = await prisma.$queryRaw<Array<{
        id: string;
        clientId: string;
        coachId: string;
        coachName: string | null;
        text: string;
        createdAt: Date;
        updatedAt: Date;
    }>>`
        SELECT
            n."id",
            n."clientId",
            n."coachId",
            u."name" AS "coachName",
            n."text",
            n."createdAt",
            n."updatedAt"
        FROM "coach_client_notes" n
        JOIN "users" u ON u."id" = n."coachId"
        WHERE n."id" = ${id}
        LIMIT 1
    `;
    if (!rows[0]) throw new Error("Failed to create note");
    return mapNote(rows[0]);
}

export async function getCoachClientNote(id: string): Promise<{
    id: string;
    clientId: string;
    coachId: string;
    text: string;
} | null> {
    await ensureCoachClientNotesTable();
    const rows = await prisma.$queryRaw<Array<{
        id: string;
        clientId: string;
        coachId: string;
        text: string;
    }>>`
        SELECT "id", "clientId", "coachId", "text"
        FROM "coach_client_notes"
        WHERE "id" = ${id}
        LIMIT 1
    `;
    return rows[0] ?? null;
}

export async function updateCoachClientNote(id: string, text: string): Promise<void> {
    await ensureCoachClientNotesTable();
    await prisma.$executeRaw`
        UPDATE "coach_client_notes"
        SET "text" = ${text}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${id}
    `;
}

export async function deleteCoachClientNote(id: string): Promise<void> {
    await ensureCoachClientNotesTable();
    await prisma.$executeRaw`
        DELETE FROM "coach_client_notes" WHERE "id" = ${id}
    `;
}
