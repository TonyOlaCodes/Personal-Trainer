import { put } from "@vercel/blob";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

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

function blobToken(): string | undefined {
    return (
        process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
        process.env.BLOB2_READ_WRITE_TOKEN?.trim() ||
        undefined
    );
}

function isVercelRuntime(): boolean {
    return Boolean(process.env.VERCEL);
}

const BLOB_NOT_CONFIGURED_MESSAGE =
    "Photo uploads need Vercel Blob storage. In the Vercel dashboard: Storage → Create Blob → connect it to this project, then redeploy.";

async function storeInBlob(buffer: Buffer, filename: string, contentType: string) {
    const token = blobToken();
    if (!token) {
        throw new Error(BLOB_NOT_CONFIGURED_MESSAGE);
    }

    const blob = await put(`uploads/${filename}`, buffer, {
        access: "public",
        contentType,
        addRandomSuffix: false,
        token,
    });

    return { url: blob.url, type: contentType };
}

async function storeLocally(buffer: Buffer, filename: string, contentType: string) {
    const dir = path.join(process.cwd(), "public", "uploads");
    try {
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, filename), buffer);
    } catch (error) {
        console.error("Local upload write failed:", error);
        throw new Error(
            isVercelRuntime()
                ? BLOB_NOT_CONFIGURED_MESSAGE
                : "Could not save upload on the server. Try a smaller photo or check server permissions."
        );
    }

    return { url: `/uploads/${filename}`, type: contentType };
}

export async function storeUploadedFile(file: File): Promise<{ url: string; type: string }> {
    if (!isAllowedUpload(file)) {
        throw new Error("Only image and video uploads are supported.");
    }

    if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error("File is too large. Please use a file under 8 MB.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = extensionFor(file);
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const contentType = file.type || "application/octet-stream";

    if (blobToken() || isVercelRuntime()) {
        return storeInBlob(buffer, filename, contentType);
    }

    return storeLocally(buffer, filename, contentType);
}
