import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

function safeFilename(filename: string): string | null {
    const base = path.basename(filename);
    if (!base || base !== filename || base.includes("..")) return null;
    if (!/^[a-zA-Z0-9._-]+$/.test(base)) return null;
    return base;
}

export async function GET(req: Request, context: { params: Promise<{ filename: string }> }) {
    try {
        const { filename } = await context.params;
        const safeName = safeFilename(filename);

        if (!safeName) {
            return new NextResponse("Not Found", { status: 404 });
        }

        const filePath = path.join(process.cwd(), "public", "uploads", safeName);

        if (!fs.existsSync(filePath)) {
            return new NextResponse("File Not Found", { status: 404 });
        }

        const buffer = await readFile(filePath);

        let mime = "application/octet-stream";
        const lower = safeName.toLowerCase();
        if (lower.endsWith(".png")) mime = "image/png";
        else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mime = "image/jpeg";
        else if (lower.endsWith(".gif")) mime = "image/gif";
        else if (lower.endsWith(".webp")) mime = "image/webp";
        else if (lower.endsWith(".heic")) mime = "image/heic";
        else if (lower.endsWith(".heif")) mime = "image/heif";
        else if (lower.endsWith(".mp4")) mime = "video/mp4";
        else if (lower.endsWith(".webm")) mime = "video/webm";
        else if (lower.endsWith(".mov") || lower.endsWith(".qt")) mime = "video/quicktime";

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": mime,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (e) {
        console.error("Error serving uploaded file:", e);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
