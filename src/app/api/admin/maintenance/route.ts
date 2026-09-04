import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/apiAuth";
import { getMaintenanceStatus, setMaintenanceMode } from "@/lib/maintenanceMode";

const updateSchema = z.object({
    enabled: z.boolean(),
    scheduledAt: z.string().datetime().nullable().optional(),
});

export async function GET(req: Request) {
    const authResult = await requireSuperAdmin(req);
    if (authResult.error) return authResult.error;

    return NextResponse.json(await getMaintenanceStatus());
}

export async function PATCH(req: Request) {
    const authResult = await requireSuperAdmin(req);
    if (authResult.error) return authResult.error;

    const parsed = updateSchema.parse(await req.json());
    const status = await setMaintenanceMode(parsed.enabled, parsed.scheduledAt ?? null);

    return NextResponse.json(status);
}
