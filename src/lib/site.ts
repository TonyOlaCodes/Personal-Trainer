/** Central site branding and SEO copy — keep fitness-focused, no AI marketing language. */
export const siteConfig = {
    name: "FitCoach Pro",
    tagline: "Fitness coaching, progress tracking, and workout planning",
    shortDescription:
        "Workout plans, progress tracking, check-ins, and direct coach communication in one place.",
    description:
        "FitCoach Pro helps athletes and coaches manage workout plans, log training sessions, track strength and body metrics, submit weekly check-ins, and stay connected — all in one platform.",
    keywords: [
        "fitness coaching",
        "workout plans",
        "personal trainer",
        "progress tracking",
        "workout logger",
        "strength training",
        "gym",
        "check-ins",
        "coach client app",
    ],
    locale: "en_GB",
    contactEmail: "tonyolajide@gmail.com",
} as const;

export function siteUrl(): string {
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    return "http://localhost:3000";
}
