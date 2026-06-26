export const THEME_IDS = ["midnight", "neon", "solar", "arctic", "jungle", "velvet"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

const LEGACY_THEME_MAP: Record<string, ThemeId> = {
    emerald: "jungle",
    ocean: "arctic",
    rose: "velvet",
};

export function normalizeTheme(stored: string | null | undefined): ThemeId {
    if (stored && (THEME_IDS as readonly string[]).includes(stored)) {
        return stored as ThemeId;
    }
    if (stored && LEGACY_THEME_MAP[stored]) {
        return LEGACY_THEME_MAP[stored];
    }
    return "midnight";
}

export const THEME_PRESETS: {
    id: ThemeId;
    name: string;
    desc: string;
    preview: string;
}[] = [
    {
        id: "midnight",
        name: "Midnight Glow",
        desc: "Sleek indigo void — deep surfaces, violet accents",
        preview: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 45%, #0a0a12 100%)",
    },
    {
        id: "neon",
        name: "Neon Tokyo",
        desc: "Cyberpunk voltage — hot pink, electric cyan, purple haze",
        preview: "linear-gradient(135deg, #ff0080 0%, #00ffff 50%, #160920 100%)",
    },
    {
        id: "solar",
        name: "Solar Forge",
        desc: "Warm copper glow — amber fire on charcoal bronze",
        preview: "linear-gradient(135deg, #ff8c00 0%, #ff3c28 50%, #1a110a 100%)",
    },
    {
        id: "arctic",
        name: "Arctic Pulse",
        desc: "Ice-smooth clarity — electric blue, mint frost, slate depth",
        preview: "linear-gradient(135deg, #38bdf8 0%, #34d399 50%, #0a1520 100%)",
    },
    {
        id: "jungle",
        name: "Jungle Voltage",
        desc: "Wild neon green — lime punch on deep forest black",
        preview: "linear-gradient(135deg, #84cc16 0%, #facc15 45%, #081810 100%)",
    },
    {
        id: "velvet",
        name: "Royal Velvet",
        desc: "Luxury rose gold — blush pink, soft violet, wine-dark rooms",
        preview: "linear-gradient(135deg, #fb7185 0%, #c084fc 50%, #180a16 100%)",
    },
];
