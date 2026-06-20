import { put } from "@vercel/blob";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
};

function extensionFor(file: File): string {
    const fromMime = MIME_TO_EXT[file.type.toLowerCase()];
    if (fromMime) return fromMime;

    const fromName = file.name.split(".").pop()?.toLowerCase();
    if (fromName && fromName.length <= 5) return fromName;

    return "bin";
}

function isAllowedUpload(file: File): boolean {
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) return true;
    const lower = file.name.toLowerCase();
    return /\.(jpe?g|png|gif|webp|heic|heif|mp4|webm|mov)$/i.test(lower);
}

export async function storeUploadedFile(file: File): Promise<{ url: string; type: string }> {
    if (!isAllowedUpload(file)) {
        throw new Error("Only image and video uploads are supported.");
    }

    if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error("File is too large. Please use a photo under 4 MB.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = extensionFor(file);
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const contentType = file.type || "application/octet-stream";

    if (process.env.BLOB_READ_WRITE_TOKEN) {
        const blob = await put(`uploads/${filename}`, buffer, {
            access: "public",
            contentType,
            addRandomSuffix: false,
        });
        return { url: blob.url, type: contentType };
    }

    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buffer);

    return { url: `/api/uploads/${filename}`, type: contentType };
}
