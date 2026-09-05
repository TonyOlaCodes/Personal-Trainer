/**
 * Shared cron authentication. Never fail open when the secret is missing.
 * Vercel cron sends `Authorization: Bearer ${CRON_SECRET}`.
 * Do not log the secret.
 */

export function isCronSecretConfigured(): boolean {
    return Boolean(process.env.CRON_SECRET);
}

export function authorizeCronRequest(req: Request): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    return req.headers.get("authorization") === `Bearer ${secret}`;
}
