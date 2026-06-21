/** Normalize stored upload paths so images load from public `/uploads/...` or absolute blob URLs. */
export function resolveUploadUrl(url: string | null | undefined): string {
    if (!url) return "";
    const trimmed = url.trim();
    if (!trimmed) return "";

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
    }

    if (trimmed.startsWith("/api/uploads/")) {
        return `/uploads/${trimmed.slice("/api/uploads/".length)}`;
    }

    if (trimmed.startsWith("/uploads/")) {
        return trimmed;
    }

    if (trimmed.startsWith("uploads/")) {
        return `/${trimmed}`;
    }

    if (!trimmed.startsWith("/") && /^[a-zA-Z0-9._-]+$/.test(trimmed)) {
        return `/uploads/${trimmed}`;
    }

    return trimmed;
}

export function withResolvedUpload<T extends { mediaUrl?: string | null }>(message: T): T {
    if (!message.mediaUrl) return message;
    return { ...message, mediaUrl: resolveUploadUrl(message.mediaUrl) };
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
