import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { storeUploadedFile } from "@/lib/uploadStorage";
import { normalizeStoredUploadUrl, resolveUploadUrl } from "@/lib/uploadUrls";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "No file received." }, { status: 400 });
        }

        const stored = await storeUploadedFile(file);
        const url = normalizeStoredUploadUrl(stored.url) ?? stored.url;
        return NextResponse.json({ url, displayUrl: resolveUploadUrl(url), type: stored.type });
    } catch (error) {
        console.error("Upload error:", error);
        const message = error instanceof Error ? error.message : "Upload failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
