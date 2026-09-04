/** Shared client-side API error text. Never surfaces stack traces or raw dumps. */

export function httpErrorMessage(
    status: number,
    body: unknown,
    fallback = "Something went wrong"
): string {
    if (status === 429) return "Too many requests. Try again shortly.";

    if (body && typeof body === "object") {
        const error = (body as { error?: unknown; message?: unknown }).error;
        if (typeof error === "string" && error.trim()) return error;
        const message = (body as { message?: unknown }).message;
        if (typeof message === "string" && message.trim()) return message;
        if (error && typeof error === "object" && "message" in error) {
            const nested = (error as { message?: unknown }).message;
            if (typeof nested === "string" && nested.trim()) return nested;
        }
    }

    return fallback;
}
