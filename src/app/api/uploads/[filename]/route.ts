import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import fs from "fs";
import { requireAuthUser } from "@/lib/apiAuth";
import { lookupStoredMediaUrl, resolveMediaForViewer } from "@/lib/mediaAccess";

export const runtime = "nodejs";

function safeFilename(filename: string): string | null {
    const base = path.basename(filename);
    if (!base || base !== filename || base.includes("..")) return null;
    if (!/^[a-zA-Z0-9._-]+$/.test(base)) return null;
    return base;
}

function mimeForName(safeName: string, fallback?: string | null): string {
    if (fallback) return fallback;
    const lower = safeName.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".heic")) return "image/heic";
    if (lower.endsWith(".heif")) return "image/heif";
    if (lower.endsWith(".mp4")) return "video/mp4";
    if (lower.endsWith(".webm")) return "video/webm";
    if (lower.endsWith(".mov") || lower.endsWith(".qt")) return "video/quicktime";
    return "application/octet-stream";
}

function fileResponse(buffer: Buffer, safeName: string, contentType?: string | null) {
    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            "Content-Type": mimeForName(safeName, contentType),
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    });
}

export async function GET(_req: Request, context: { params: Promise<{ filename: string }> }) {
    try {
        const authResult = await requireAuthUser(_req);
        if (authResult.error) return authResult.error;

        const { filename } = await context.params;
        const safeName = safeFilename(filename);
        if (!safeName) {
            return new NextResponse("Not Found", { status: 404 });
        }

        const asset = await resolveMediaForViewer(safeName, authResult.user);
        if (!asset) {
            return new NextResponse("Not Found", { status: 404 });
        }

        const storedUrl = asset.blobUrl ?? await lookupStoredMediaUrl(safeName);
        if (storedUrl && (storedUrl.startsWith("http://") || storedUrl.startsWith("https://"))) {
            const remote = await fetch(storedUrl);
            if (!remote.ok) {
                return new NextResponse("Not Found", { status: 404 });
            }
            const buffer = Buffer.from(await remote.arrayBuffer());
            return fileResponse(
                buffer,
                safeName,
                remote.headers.get("content-type") ?? asset.contentType
            );
        }

        const filePath = path.join(process.cwd(), "public", "uploads", safeName);
        if (!fs.existsSync(filePath)) {
            return new NextResponse("File Not Found", { status: 404 });
        }

        const buffer = await readFile(filePath);
        return fileResponse(buffer, safeName, asset.contentType);
    } catch (e) {
        console.error("Error serving uploaded file:", e);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
