const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface PlanTextExercise {
    name: string;
    sets: number;
    reps: string;
    weightTargetKg?: number;
    muscleGroup?: string | null;
}

export interface PlanTextWorkout {
    name: string;
    dayNumber: number;
    dayOfWeek?: number | null;
    exercises: PlanTextExercise[];
}

export interface PlanTextWeek {
    weekNumber: number;
    name?: string;
    workouts: PlanTextWorkout[];
}

function isCardioExercise(name: string, muscleGroup?: string | null): boolean {
    if (muscleGroup?.toLowerCase() === "cardio") return true;
    const n = name.toLowerCase();
    return /treadmill|bike|cycling|run|row|elliptical|cardio|walk|sprint|ski erg|jump rope/.test(n);
}

function formatExerciseLine(ex: PlanTextExercise): string {
    const cardio = isCardioExercise(ex.name, ex.muscleGroup);
    const volume = cardio
        ? `${ex.sets} round${ex.sets === 1 ? "" : "s"} × ${ex.reps}${/min/i.test(ex.reps) ? "" : " mins"}`
        : `${ex.sets} set${ex.sets === 1 ? "" : "s"} × ${ex.reps} reps`;
    let line = `  • ${ex.name || "Exercise"} — ${volume}`;
    if (ex.weightTargetKg && !cardio) {
        line += ` @ ${ex.weightTargetKg} kg`;
    }
    return line;
}

export function formatWorkoutText(workout: PlanTextWorkout): string {
    const dayLabel =
        workout.dayOfWeek !== null && workout.dayOfWeek !== undefined
            ? DAY_LABELS[workout.dayOfWeek]
            : null;
    const header = dayLabel
        ? `Day ${workout.dayNumber} (${dayLabel}) — ${workout.name}`
        : `Day ${workout.dayNumber} — ${workout.name}`;

    const lines = [header];
    if (workout.exercises.length === 0) {
        lines.push("  (no exercises)");
    } else {
        for (const ex of workout.exercises) {
            lines.push(formatExerciseLine(ex));
        }
    }
    return lines.join("\n");
}

export function formatWeekText(week: PlanTextWeek): string {
    const title = week.name?.trim()
        ? `Week ${week.weekNumber} — ${week.name.trim()}`
        : `Week ${week.weekNumber}`;
    const blocks = [title];
    for (const workout of week.workouts) {
        blocks.push("", formatWorkoutText(workout));
    }
    return blocks.join("\n").trimEnd();
}

export function formatPlanText(plan: {
    name: string;
    description?: string | null;
    weeks: PlanTextWeek[];
}): string {
    const parts: string[] = [plan.name.trim() || "Training Plan"];
    if (plan.description?.trim()) {
        parts.push("", plan.description.trim());
    }
    parts.push("", "─".repeat(36));
    for (let i = 0; i < plan.weeks.length; i++) {
        if (i > 0) parts.push("");
        parts.push(formatWeekText(plan.weeks[i]));
    }
    return parts.join("\n").trimEnd();
}
