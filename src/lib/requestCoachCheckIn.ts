/** Safe client-facing copy. Never surface Zod/API validation objects. */
export const CHECK_IN_REQUEST_FAILED_MESSAGE = "Could not request check-in. Please try again.";

type RequestCoachCheckInInput = {
    clientId: string;
    weekNumber?: number | null;
    periodDueDateKey?: string | null;
    note?: string;
    /** Check-ins page uses the dedicated route; all other surfaces use chat. */
    via?: "chat" | "checkins";
};

export type RequestCoachCheckInResult =
    | {
        ok: true;
        throttled: boolean;
        message?: string;
        requestedAt?: string;
    }
    | { ok: false; message: string };

/**
 * Single client entry point for every Request Check-In button.
 * Both APIs resolve the outstanding period server-side via Europe/Dublin date keys.
 */
export async function requestCoachCheckIn(
    input: RequestCoachCheckInInput
): Promise<RequestCoachCheckInResult> {
    const via = input.via ?? "chat";
    const url = via === "checkins"
        ? "/api/coach/check-in-requests"
        : "/api/coach/chat/request-checkin";

    const body = via === "checkins"
        ? {
            clientId: input.clientId,
            weekNumber: input.weekNumber,
        }
        : {
            clientId: input.clientId,
            ...(input.note?.trim() ? { note: input.note.trim() } : {}),
            ...(input.weekNumber != null
                ? {
                    weekNumber: input.weekNumber,
                    ...(input.periodDueDateKey ? { periodDueDateKey: input.periodDueDateKey } : {}),
                }
                : {}),
        };

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            console.error("[requestCoachCheckIn]", { status: res.status, data });
            return {
                ok: false,
                message: res.status === 429
                    ? "Too many requests. Try again shortly."
                    : CHECK_IN_REQUEST_FAILED_MESSAGE,
            };
        }

        return {
            ok: true,
            throttled: Boolean(data.throttled),
            message: typeof data.message === "string" ? data.message : undefined,
            requestedAt:
                data.request?.lastRequestedAt
                ?? data.request?.requestedAt
                ?? undefined,
        };
    } catch (err) {
        console.error("[requestCoachCheckIn]", err);
        return { ok: false, message: CHECK_IN_REQUEST_FAILED_MESSAGE };
    }
}
