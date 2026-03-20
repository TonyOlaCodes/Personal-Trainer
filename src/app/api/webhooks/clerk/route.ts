import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
        return NextResponse.json({ error: "No webhook secret" }, { status: 500 });
    }

    const headerPayload = await headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
        return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
    }

    const payload = await req.json();
    const body = JSON.stringify(payload);

    const wh = new Webhook(WEBHOOK_SECRET);
    let evt: { type: string; data: { id: string; email_addresses: { email_address: string }[]; first_name?: string; last_name?: string; image_url?: string } };

    try {
        evt = wh.verify(body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        }) as typeof evt;
    } catch {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const { type, data } = evt;

    if (type === "user.created") {
        await prisma.user.create({
            data: {
                clerkId: data.id,
                email: data.email_addresses[0]?.email_address ?? "",
                name: [data.first_name, data.last_name].filter(Boolean).join(" ") || null,
                avatarUrl: data.image_url ?? null,
            },
        });
    }

    if (type === "user.updated") {
        await prisma.user.updateMany({
            where: { clerkId: data.id },
            data: {
                email: data.email_addresses[0]?.email_address ?? "",
                name: [data.first_name, data.last_name].filter(Boolean).join(" ") || null,
                avatarUrl: data.image_url ?? null,
            },
        });
    }

    if (type === "user.deleted") {
        await prisma.user.deleteMany({ where: { clerkId: data.id } });
    }

    return NextResponse.json({ received: true });
}
