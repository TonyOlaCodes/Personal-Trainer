/** Extract a safe uploads filename from any stored upload path, or null. */
export function extractUploadFilename(url: string): string | null {
    let candidate = url.trim();
    if (!candidate) return null;

    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
        try {
            const parsed = new URL(candidate);
            const last = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
            candidate = last;
        } catch {
            return null;
        }
    } else if (candidate.startsWith("/api/uploads/")) {
        candidate = candidate.slice("/api/uploads/".length);
    } else if (candidate.startsWith("/uploads/")) {
        candidate = candidate.slice("/uploads/".length);
    } else if (candidate.startsWith("uploads/")) {
        candidate = candidate.slice("uploads/".length);
    }

    const qIndex = candidate.indexOf("?");
    if (qIndex >= 0) candidate = candidate.slice(0, qIndex);

    if (/^[a-zA-Z0-9._-]+$/.test(candidate)) {
        return candidate;
    }

    return null;
}

/**
 * Normalize stored upload paths for display.
 * Blob/external URLs pass through; app uploads are served via `/api/uploads/[filename]`.
 */
export function resolveUploadUrl(url: string | null | undefined): string {
    if (!url) return "";
    const trimmed = url.trim();
    if (!trimmed) return "";

    const filename = extractUploadFilename(trimmed);
    if (filename) {
        return `/api/uploads/${filename}`;
    }

    return trimmed;
}

/** Canonical form to persist in the database (blob URL or `/uploads/...`). */
export function normalizeStoredUploadUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
    }

    const filename = extractUploadFilename(trimmed);
    if (filename) {
        return `/uploads/${filename}`;
    }

    return trimmed;
}

export function withResolvedUpload<T extends { mediaUrl?: string | null }>(message: T): T {
    if (!message.mediaUrl) return message;
    return { ...message, mediaUrl: resolveUploadUrl(message.mediaUrl) };
}

export function withResolvedAvatar<T extends { avatarUrl?: string | null }>(entity: T): T {
    if (!entity.avatarUrl) return entity;
    return { ...entity, avatarUrl: resolveUploadUrl(entity.avatarUrl) };
}

export function withResolvedCheckInMedia<T extends {
    frontImageUrl?: string | null;
    sideImageUrl?: string | null;
    videoUrl?: string | null;
    coachVideoUrl?: string | null;
}>(checkIn: T): T {
    return {
        ...checkIn,
        frontImageUrl: checkIn.frontImageUrl ? resolveUploadUrl(checkIn.frontImageUrl) : checkIn.frontImageUrl,
        sideImageUrl: checkIn.sideImageUrl ? resolveUploadUrl(checkIn.sideImageUrl) : checkIn.sideImageUrl,
        videoUrl: checkIn.videoUrl ? resolveUploadUrl(checkIn.videoUrl) : checkIn.videoUrl,
        coachVideoUrl: checkIn.coachVideoUrl ? resolveUploadUrl(checkIn.coachVideoUrl) : checkIn.coachVideoUrl,
    };
}

export function withResolvedLogSetMedia<T extends { videoUrl?: string | null }>(set: T): T {
    if (!set.videoUrl) return set;
    return { ...set, videoUrl: resolveUploadUrl(set.videoUrl) };
}
