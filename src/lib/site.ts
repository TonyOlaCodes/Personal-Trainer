/** Central site branding and SEO copy. */
export const siteConfig = {
    name: "TOLGcoaching",
    shortName: "TOLG",
    /** Logo wordmark split: TOLG + coaching */
    brandPrefix: "TOLG",
    brandSuffix: "coaching",
    handle: "thatoneleanguy",
    motto: "Train · Optimise · Learn · Grow",
    mottoExpanded: {
        train: "Train",
        optimise: "Optimise",
        learn: "Learn",
        grow: "Grow",
    },
    tagline: "Train · Optimise · Learn · Grow",
    shortDescription:
        "Coaching from thatoneleanguy — workout plans, progress tracking, check-ins, and direct coach chat in one place.",
    description:
        "TOLGcoaching helps athletes Train, Optimise, Learn, and Grow with structured plans, session logging, weekly check-ins, and coach messaging — built by thatoneleanguy.",
    keywords: [
        "TOLG coaching",
        "thatoneleanguy",
        "fitness coaching",
        "workout plans",
        "personal trainer",
        "progress tracking",
        "workout logger",
        "strength training",
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
