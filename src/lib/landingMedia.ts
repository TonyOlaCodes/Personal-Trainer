/**
 * Landing page static media — all assets live under `public/landing/`.
 * Import paths and copy from here; do not hardcode `/landing/...` in components.
 */

export const LANDING_MEDIA_ROOT = "/landing" as const;

export const LANDING_MEDIA_DIRS = {
    videos: "videos",
    transformations: "transformations",
    screenshots: "screenshots",
    photos: "photos",
    icons: "icons",
} as const;

export type LandingMediaCategory = keyof typeof LANDING_MEDIA_DIRS;

export const LANDING_MEDIA = {
    videos: `${LANDING_MEDIA_ROOT}/${LANDING_MEDIA_DIRS.videos}`,
    transformations: `${LANDING_MEDIA_ROOT}/${LANDING_MEDIA_DIRS.transformations}`,
    screenshots: `${LANDING_MEDIA_ROOT}/${LANDING_MEDIA_DIRS.screenshots}`,
    photos: `${LANDING_MEDIA_ROOT}/${LANDING_MEDIA_DIRS.photos}`,
    icons: `${LANDING_MEDIA_ROOT}/${LANDING_MEDIA_DIRS.icons}`,
} as const;

/** Build a public URL for a file in a landing media folder (handles spaces & special chars). */
export function landingMediaUrl(category: LandingMediaCategory, filename: string): string {
    const base = LANDING_MEDIA[category];
    const clean = filename.replace(/^\/+/, "");
    return `${base}/${clean.split("/").map(encodeURIComponent).join("/")}`;
}

/** Current files in `public/landing/` — update when assets change. */
export const LANDING_MEDIA_FILES = {
    videos: {
        deadlift: "deadlift.mov",
        benchPress: "benchpress.MOV",
        squat: "squat.MOV",
    },
    transformations: {
        before: "transform_before.jpg",
        after: "tranform_after.jpg",
    },
    photos: {
        celebration: "celebration.png",
    },
    screenshots: {},
    icons: {},
} as const;

export function landingMediaSlot(
    category: LandingMediaCategory,
    slot: string
): string {
    const files = LANDING_MEDIA_FILES[category] as Record<string, string>;
    const file = files[slot];
    if (!file) throw new Error(`Unknown landing media slot: ${category}.${slot}`);
    return landingMediaUrl(category, file);
}

export const LANDING_TRANSFORMATION = {
    title: "My transformation",
    progressLabel: "2 Years of Progress",
    beforeKg: 65,
    afterKg: 77,
    caption:
        "Built through consistent training, structured programming and tracking.",
} as const;

export const LANDING_LIFTS = [
    {
        id: "deadlift",
        label: "Deadlift",
        stat: "250 kg",
        video: LANDING_MEDIA_FILES.videos.deadlift,
    },
    {
        id: "bench",
        label: "Bench press",
        stat: "120 kg × 6",
        video: LANDING_MEDIA_FILES.videos.benchPress,
    },
    {
        id: "squat",
        label: "Squat",
        stat: "195 kg",
        video: LANDING_MEDIA_FILES.videos.squat,
    },
] as const;
