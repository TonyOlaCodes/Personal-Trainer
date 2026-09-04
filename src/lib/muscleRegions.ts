export type MuscleRegion =
    | "chest"
    | "upperBack"
    | "lats"
    | "lowerBack"
    | "traps"
    | "shoulders"
    | "biceps"
    | "triceps"
    | "forearms"
    | "core"
    | "obliques"
    | "glutes"
    | "quads"
    | "hamstrings"
    | "calves";

export const MUSCLE_REGION_LABELS: Record<MuscleRegion, string> = {
    chest: "Chest",
    upperBack: "Upper back",
    lats: "Lats",
    lowerBack: "Lower back",
    traps: "Traps",
    shoulders: "Shoulders",
    biceps: "Biceps",
    triceps: "Triceps",
    forearms: "Forearms",
    core: "Core",
    obliques: "Obliques",
    glutes: "Glutes",
    quads: "Quads",
    hamstrings: "Hamstrings",
    calves: "Calves",
};

export const ALL_MUSCLE_REGIONS = Object.keys(MUSCLE_REGION_LABELS) as MuscleRegion[];
