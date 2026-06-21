import { resolveUploadUrl } from "@/lib/uploadUrls";

/** Resize/compress photos before upload so mobile shots stay under server limits. */
export async function compressImageForUpload(file: File, maxWidth = 1600): Promise<File> {
    if (!file.type.startsWith("image/") || file.type === "image/gif") {
        return file;
    }

    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxWidth / bitmap.width);
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            bitmap.close();
            return file;
        }

        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, "image/jpeg", 0.85);
        });

        if (!blob) return file;

        const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
        return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
    } catch {
        return file;
    }
}

export async function uploadMediaFile(file: File): Promise<string> {
    const payload = file.type.startsWith("image/") ? await compressImageForUpload(file) : file;
    const formData = new FormData();
    formData.append("file", payload);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
    }

    if (!data.url) {
        throw new Error("Upload failed: no file URL returned");
    }

    return resolveUploadUrl(data.url as string);
}

export { resolveUploadUrl } from "@/lib/uploadUrls";
