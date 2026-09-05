import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { z } from "zod";
import { canAccessClient, requireCoachCanEditClient, requireCoachUser } from "@/lib/apiAuth";
import {
    createCoachClientNote,
    deleteCoachClientNote,
    getCoachClientNote,
    listCoachClientNotes,
    updateCoachClientNote,
} from "@/lib/coachClientNotes";
import { enforceRateLimit } from "@/lib/rateLimit";

const createSchema = z.object({
    clientId: z.string().min(1),
    text: z.string().trim().min(1).max(4000),
});

const updateSchema = z.object({
    id: z.string().min(1),
    text: z.string().trim().min(1).max(4000),
});

const deleteSchema = z.object({
    id: z.string().min(1),
});

async function canMutateNote(
    actor: { id: string; role: Role },
    note: { clientId: string; coachId: string }
) {
    if (!(await canAccessClient(actor, note.clientId))) return false;
    if (actor.role === "SUPER_ADMIN") return true;
    return note.coachId === actor.id;
}

export async function GET(req: Request) {
    const authResult = await requireCoachUser(req);
    if (authResult.error) return authResult.error;

    const clientId = new URL(req.url).searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    if (!(await canAccessClient(authResult.user, clientId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const notes = await listCoachClientNotes(clientId);
    return NextResponse.json({ notes });
}

export async function POST(req: Request) {
    const authResult = await requireCoachUser(req);
    if (authResult.error) return authResult.error;
    const limited = await enforceRateLimit(req, "coachClientNote", authResult.user.id);
    if (limited) return limited;

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid note" }, { status: 400 });

    const editCheck = await requireCoachCanEditClient(authResult.user, parsed.data.clientId);
    if (editCheck.error) return editCheck.error;

    const note = await createCoachClientNote(parsed.data.clientId, authResult.user.id, parsed.data.text);
    return NextResponse.json({ note }, { status: 201 });
}

export async function PATCH(req: Request) {
    const authResult = await requireCoachUser(req);
    if (authResult.error) return authResult.error;
    const limited = await enforceRateLimit(req, "coachClientNote", authResult.user.id);
    if (limited) return limited;

    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid note" }, { status: 400 });

    const existing = await getCoachClientNote(parsed.data.id);
    if (!existing) return NextResponse.json({ error: "Note not found" }, { status: 404 });
    if (!(await canMutateNote(authResult.user, existing))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const editCheck = await requireCoachCanEditClient(authResult.user, existing.clientId);
    if (editCheck.error) return editCheck.error;

    await updateCoachClientNote(existing.id, parsed.data.text);
    return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
    const authResult = await requireCoachUser(req);
    if (authResult.error) return authResult.error;
    const limited = await enforceRateLimit(req, "coachClientNote", authResult.user.id);
    if (limited) return limited;

    const parsed = deleteSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid note" }, { status: 400 });

    const existing = await getCoachClientNote(parsed.data.id);
    if (!existing) return NextResponse.json({ error: "Note not found" }, { status: 404 });
    if (!(await canMutateNote(authResult.user, existing))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const editCheck = await requireCoachCanEditClient(authResult.user, existing.clientId);
    if (editCheck.error) return editCheck.error;

    await deleteCoachClientNote(existing.id);
    return NextResponse.json({ ok: true });
}
