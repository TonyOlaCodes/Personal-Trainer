import { getMediaAsset } from "@/lib/mediaAccess";
import { extractUploadFilename } from "@/lib/uploadUrls";

export type AttachUploadDecision =
    | { ok: true; reason: "empty" | "owned" | "unregistered" | "not_our_upload" }
    | { ok: false; reason: "foreign_owner" };

/**
 * Write-side ownership only. Does not solve private-media IDOR (C1)
 * or public Blob URL exposure (C3).
 *
 * If media_assets has an owner, only that user may attach the file.
 * Legacy uploads without a registry row cannot be proven foreign — allow
 * and report the C1/C3 dependency.
 */
export function decideAttachUploadOwnership(input: {
    actorId: string;
    ownerUserId: string | null;
    filename: string | null;
}): AttachUploadDecision {
    if (!input.filename) {
        return { ok: true, reason: "not_our_upload" };
    }
    if (!input.ownerUserId) {
        return { ok: true, reason: "unregistered" };
    }
    if (input.ownerUserId === input.actorId) {
        return { ok: true, reason: "owned" };
    }
    return { ok: false, reason: "foreign_owner" };
}

export async function resolveAttachUploadOwnership(
    actorId: string,
    url: string | null | undefined
): Promise<AttachUploadDecision> {
    if (url == null || String(url).trim() === "") {
        return { ok: true, reason: "empty" };
    }

    const filename = extractUploadFilename(url);
    if (!filename) {
        return { ok: true, reason: "not_our_upload" };
    }

    const asset = await getMediaAsset(filename);
    return decideAttachUploadOwnership({
        actorId,
        ownerUserId: asset?.ownerUserId ?? null,
        filename,
    });
}

export async function canActorAttachUploads(
    actorId: string,
    urls: Array<string | null | undefined>
): Promise<boolean> {
    for (const url of urls) {
        const decision = await resolveAttachUploadOwnership(actorId, url);
        if (!decision.ok) return false;
    }
    return true;
}
