export const WORKOUT_FEELING_EMOJIS = ["😵", "😓", "😐", "💪", "🔥"] as const;
export const WORKOUT_FEELING_LABELS = ["Awful", "Bad", "Okay", "Good", "Great"] as const;

export function workoutFeelingEmoji(feeling: number | null | undefined): string | null {
    if (!feeling || feeling < 1 || feeling > 5) return null;
    return WORKOUT_FEELING_EMOJIS[feeling - 1];
}

export function workoutFeelingLabel(feeling: number | null | undefined): string | null {
    if (!feeling || feeling < 1 || feeling > 5) return null;
    return WORKOUT_FEELING_LABELS[feeling - 1];
}
