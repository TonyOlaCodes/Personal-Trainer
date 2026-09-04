import type { UnitSystem } from "@/lib/units";
import { formatWeightFromKg, kgToLbsNumber, CM_PER_INCH } from "@/lib/units";
import type { ExerciseTrackingSchema, SetMetrics } from "./types";
import { isFieldEnabled } from "./schema";

export function formatDurationSec(sec: number | null | undefined): string {
    if (sec == null || !Number.isFinite(sec) || sec < 0) return "—";
    if (sec < 60) return `${Math.round(sec)}s`;
    const minutes = Math.floor(sec / 60);
    const seconds = Math.round(sec % 60);
    if (minutes < 60) {
        return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
}

export function formatDistanceMeters(
    meters: number | null | undefined,
    unitSystem: UnitSystem = "METRIC"
): string {
    if (meters == null || !Number.isFinite(meters) || meters < 0) return "—";
    if (unitSystem === "IMPERIAL") {
        const miles = meters / 1609.344;
        if (miles >= 0.1) return `${miles.toFixed(2)} mi`;
        const feet = meters / 0.3048;
        return `${Math.round(feet)} ft`;
    }
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${Math.round(meters * 10) / 10} m`;
}

export function formatHeightCm(
    cm: number | null | undefined,
    unitSystem: UnitSystem = "METRIC"
): string {
    if (cm == null || !Number.isFinite(cm) || cm < 0) return "—";
    if (unitSystem === "IMPERIAL") {
        return `${(cm / CM_PER_INCH).toFixed(1)} in`;
    }
    return `${Math.round(cm * 10) / 10} cm`;
}

export function formatSpeedKph(
    kph: number | null | undefined,
    unitSystem: UnitSystem = "METRIC"
): string {
    if (kph == null || !Number.isFinite(kph) || kph < 0) return "—";
    if (unitSystem === "IMPERIAL") {
        return `${(kph / 1.609344).toFixed(1)} mph`;
    }
    return `${kph.toFixed(1)} km/h`;
}

/** Pace as sec per km (canonical). */
export function paceSecPerKm(distanceMeters: number, durationSec: number): number | null {
    if (!(distanceMeters > 0) || !(durationSec > 0)) return null;
    return (durationSec / distanceMeters) * 1000;
}

export function formatPace(
    distanceMeters: number | null | undefined,
    durationSec: number | null | undefined,
    unitSystem: UnitSystem = "METRIC"
): string {
    if (distanceMeters == null || durationSec == null) return "—";
    const secPerKm = paceSecPerKm(distanceMeters, durationSec);
    if (secPerKm == null) return "—";
    const secPerUnit = unitSystem === "IMPERIAL" ? secPerKm * 1.609344 : secPerKm;
    const minutes = Math.floor(secPerUnit / 60);
    const seconds = Math.round(secPerUnit % 60);
    const suffix = unitSystem === "IMPERIAL" ? "/mi" : "/km";
    return `${minutes}:${seconds.toString().padStart(2, "0")}${suffix}`;
}

/** Compact one-line summary for previous-session / history cards. */
export function formatSetSummary(
    set: SetMetrics,
    schema: ExerciseTrackingSchema,
    unitSystem: UnitSystem = "METRIC"
): string {
    const parts: string[] = [];

    if (isFieldEnabled(schema, "weight") && (set.weightKg ?? 0) > 0) {
        parts.push(formatWeightFromKg(set.weightKg, unitSystem));
    }
    if (isFieldEnabled(schema, "reps") && (set.reps ?? 0) > 0) {
        parts.push(`${set.reps} reps`);
    }
    if (isFieldEnabled(schema, "duration") && (set.durationSec ?? 0) > 0) {
        parts.push(formatDurationSec(set.durationSec));
    }
    if (isFieldEnabled(schema, "distance") && (set.distanceMeters ?? 0) > 0) {
        parts.push(formatDistanceMeters(set.distanceMeters, unitSystem));
    }
    if (isFieldEnabled(schema, "height") && (set.heightCm ?? 0) > 0) {
        parts.push(formatHeightCm(set.heightCm, unitSystem));
    }
    if (isFieldEnabled(schema, "speed") && (set.speedKph ?? 0) > 0) {
        parts.push(formatSpeedKph(set.speedKph, unitSystem));
    }
    if (isFieldEnabled(schema, "resistance") && set.resistance != null) {
        parts.push(`Lvl ${set.resistance}`);
    }
    if (isFieldEnabled(schema, "incline") && set.inclinePct != null) {
        parts.push(`${set.inclinePct}%`);
    }
    if (isFieldEnabled(schema, "calories") && (set.calories ?? 0) > 0) {
        parts.push(`${Math.round(set.calories!)} kcal`);
    }
    if (isFieldEnabled(schema, "heartRate") && (set.heartRate ?? 0) > 0) {
        parts.push(`${set.heartRate} bpm`);
    }
    if (
        isFieldEnabled(schema, "pace") &&
        isFieldEnabled(schema, "distance") &&
        isFieldEnabled(schema, "duration")
    ) {
        const pace = formatPace(set.distanceMeters, set.durationSec, unitSystem);
        if (pace !== "—") parts.push(pace);
    }
    if (isFieldEnabled(schema, "rpe") && set.rpe != null) {
        parts.push(`RPE ${set.rpe}`);
    }

    // Historical fallback: show fields that have data even if the schema no longer enables them.
    const already = new Set(parts);
    const pushUnique = (s: string) => {
        if (!already.has(s)) {
            parts.push(s);
            already.add(s);
        }
    };
    if (!isFieldEnabled(schema, "weight") && (set.weightKg ?? 0) > 0) {
        pushUnique(formatWeightFromKg(set.weightKg, unitSystem));
    }
    if (!isFieldEnabled(schema, "reps") && (set.reps ?? 0) > 0) {
        pushUnique(`${set.reps} reps`);
    }
    if (!isFieldEnabled(schema, "duration") && (set.durationSec ?? 0) > 0) {
        pushUnique(formatDurationSec(set.durationSec));
    }
    if (!isFieldEnabled(schema, "distance") && (set.distanceMeters ?? 0) > 0) {
        pushUnique(formatDistanceMeters(set.distanceMeters, unitSystem));
    }
    if (!isFieldEnabled(schema, "height") && (set.heightCm ?? 0) > 0) {
        pushUnique(formatHeightCm(set.heightCm, unitSystem));
    }

    return parts.length > 0 ? parts.join(" · ") : "—";
}

export function displayWeightValue(
    kg: number | null | undefined,
    unitSystem: UnitSystem
): string {
    if (kg == null || !Number.isFinite(kg)) return "";
    if (unitSystem === "IMPERIAL") return String(Math.round(kgToLbsNumber(kg) * 10) / 10);
    return String(kg);
}
