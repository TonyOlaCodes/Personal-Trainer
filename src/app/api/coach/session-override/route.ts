/**
 * Coach-facing session override API — thin wrapper over /api/session-override
 * kept for existing coach clients; prefer the shared route for new code.
 */
export { GET, POST, DELETE } from "@/app/api/session-override/route";
