export const MUSCLE_GROUPS = [
    "Chest",
    "Back",
    "Shoulders",
    "Biceps",
    "Triceps",
    "Forearms",
    "Traps",
    "Quads",
    "Hamstrings",
    "Glutes",
    "Calves",
    "Legs",
    "Core",
    "Cardio",
    "Full Body",
    "Calisthenics",
    "CrossFit",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_GROUP_COLORS: Record<string, string> = {
    Chest: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    Back: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    Shoulders: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Biceps: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    Triceps: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    Forearms: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20",
    Traps: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    Quads: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    Hamstrings: "bg-lime-500/10 text-lime-400 border-lime-500/20",
    Glutes: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    Calves: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    Legs: "bg-green-500/10 text-green-400 border-green-500/20",
    Core: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    Cardio: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    "Full Body": "bg-brand-500/10 text-brand-400 border-brand-500/20",
    Calisthenics: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    CrossFit: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function muscleGroupBadgeClass(group: string | null | undefined) {
    return MUSCLE_GROUP_COLORS[group ?? ""] ?? "bg-surface-muted text-fg-subtle border-surface-border";
}
