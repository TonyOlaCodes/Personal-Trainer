import { NextResponse } from "next/server";
import { storeUploadedFile } from "@/lib/uploadStorage";
import { normalizeStoredUploadUrl, resolveUploadUrl } from "@/lib/uploadUrls";
import { parseMediaPurpose, registerMediaAsset } from "@/lib/mediaAccess";
import { requireAuthUser } from "@/lib/apiAuth";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const authResult = await requireAuthUser(req);
        if (authResult.error) return authResult.error;
        const user = authResult.user;

        const formData = await req.formData();
        const file = formData.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "No file received." }, { status: 400 });
        }

        const purpose = parseMediaPurpose(
            typeof formData.get("purpose") === "string" ? String(formData.get("purpose")) : null
        );
        const stored = await storeUploadedFile(file);
        const storedUrl = `/uploads/${stored.filename}`;
        await registerMediaAsset({
            filename: stored.filename,
            ownerUserId: user.id,
            purpose,
            blobUrl: stored.url.startsWith("http") ? stored.url : null,
            contentType: stored.type,
        });

        const url = normalizeStoredUploadUrl(storedUrl) ?? storedUrl;
        return NextResponse.json({ url, displayUrl: resolveUploadUrl(url), type: stored.type });
    } catch (error) {
        console.error("Upload error:", error);
        const message = error instanceof Error ? error.message : "Upload failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
