/**
 * Period lifestyle stats from daily metric logs.
 *
 * Missing days are excluded. A logged 0 is a real 0.
 * Direction is metric-specific — calories are not "higher is better".
 */

export type LifestyleMetricKey = "calories" | "steps" | "sleep";

export interface LifestyleDayValue {
    date: string;
    calories: number | null;
    steps: number | null;
    sleepHours: number | null;
}

export interface LifestyleMetricSummary {
    key: LifestyleMetricKey;
    average: number | null;
    target: number | null;
    /** On-target share of legitimately logged days only. Missing days are excluded. */
    adherencePercent: number | null;
    loggedDays: number;
    expectedDays: number;
    /** loggedDays / expectedDays. Missing days lower this; they never become zeros. */
    loggingRatePercent: number;
    onTargetDays: number | null;
    assessment: string | null;
}

/** Logging coverage for a period. 4/82 → 5%, 0/82 → 0%, 82/82 → 100%. */
export function lifestyleLoggingRatePercent(loggedDays: number, expectedDays: number): number {
    if (expectedDays <= 0) return 0;
    return Math.round((loggedDays / expectedDays) * 100);
}

/** Compact logged-count line, e.g. `4/82 · 5%`. */
export function formatLifestyleLoggedCount(loggedDays: number, expectedDays: number): string {
    return `${loggedDays}/${expectedDays} · ${lifestyleLoggingRatePercent(loggedDays, expectedDays)}%`;
}

export interface LifestylePeriodSummaries {
    calories: LifestyleMetricSummary;
    steps: LifestyleMetricSummary;
    sleep: LifestyleMetricSummary;
}

export const CALORIE_TOLERANCE_RATIO = 0.1;
export const CALORIE_TOLERANCE_MIN = 100;
export const SLEEP_LOWER_SLACK_HOURS = 0.5;
export const SLEEP_UPPER_SLACK_HOURS = 2;
export const SLEEP_USEFUL_CAP_HOURS = 11;

function isLoggedNumber(value: number | null | undefined): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

export function calorieTolerance(target: number): number {
    return Math.max(CALORIE_TOLERANCE_MIN, Math.round(target * CALORIE_TOLERANCE_RATIO));
}

export function isCaloriesOnTarget(value: number, target: number): boolean {
    return Math.abs(value - target) <= calorieTolerance(target);
}

export function isStepsOnTarget(value: number, target: number): boolean {
    return value >= target;
}

/** Sleep is on target in a useful band — 14h is not "better than 8h". */
export function isSleepOnTarget(value: number, target: number): boolean {
    const lower = target - SLEEP_LOWER_SLACK_HOURS;
    const upper = Math.min(SLEEP_USEFUL_CAP_HOURS, target + SLEEP_UPPER_SLACK_HOURS);
    return value >= lower && value <= upper;
}

function averageLogged(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundMetric(key: LifestyleMetricKey, value: number | null): number | null {
    if (value == null) return null;
    if (key === "sleep") return Math.round(value * 10) / 10;
    return Math.round(value);
}

function assessCalories(average: number | null, target: number | null, loggedDays: number): string | null {
    if (average == null || target == null || loggedDays === 0) return null;
    if (isCaloriesOnTarget(average, target)) return "On target";
    return average < target ? "Below target" : "Above target";
}

function assessSteps(adherencePercent: number | null, loggedDays: number): string | null {
    if (adherencePercent == null || loggedDays === 0) return null;
    if (adherencePercent >= 85) return "On track";
    if (adherencePercent >= 70) return "Close to target";
    return "Behind target";
}

function assessSleep(average: number | null, target: number | null, loggedDays: number): string | null {
    if (average == null || target == null || loggedDays === 0) return null;
    const upper = Math.min(SLEEP_USEFUL_CAP_HOURS, target + SLEEP_UPPER_SLACK_HOURS);
    if (average > upper) return "Longer than useful";
    if (average < target - SLEEP_LOWER_SLACK_HOURS) return "Below target";
    return "On target";
}

function summarizeMetric(
    key: LifestyleMetricKey,
    values: number[],
    target: number | null,
    expectedDays: number,
    onTarget: ((value: number, target: number) => boolean) | null,
    assess: (average: number | null, target: number | null, loggedDays: number, adherence: number | null) => string | null
): LifestyleMetricSummary {
    const loggedDays = values.length;
    const average = roundMetric(key, averageLogged(values));
    let onTargetDays: number | null = null;
    let adherencePercent: number | null = null;

    if (target != null && loggedDays > 0 && onTarget) {
        onTargetDays = values.filter((value) => onTarget(value, target)).length;
        adherencePercent = Math.round((onTargetDays / loggedDays) * 100);
    }

    return {
        key,
        average,
        target,
        adherencePercent,
        loggedDays,
        expectedDays,
        loggingRatePercent: lifestyleLoggingRatePercent(loggedDays, expectedDays),
        onTargetDays,
        assessment: assess(average, target, loggedDays, adherencePercent),
    };
}

export function summarizeLifestylePeriod(
    rows: LifestyleDayValue[],
    targets: { targetCalories: number | null; targetSteps: number | null; targetSleepHours: number | null },
    expectedDays: number
): LifestylePeriodSummaries {
    const calories = rows.map((row) => row.calories).filter(isLoggedNumber);
    const steps = rows.map((row) => row.steps).filter(isLoggedNumber);
    const sleep = rows.map((row) => row.sleepHours).filter(isLoggedNumber);

    return {
        calories: summarizeMetric(
            "calories",
            calories,
            targets.targetCalories,
            expectedDays,
            targets.targetCalories != null ? isCaloriesOnTarget : null,
            (average, target, loggedDays) => assessCalories(average, target, loggedDays)
        ),
        steps: summarizeMetric(
            "steps",
            steps,
            targets.targetSteps,
            expectedDays,
            targets.targetSteps != null ? isStepsOnTarget : null,
            (_average, _target, loggedDays, adherence) => assessSteps(adherence, loggedDays)
        ),
        sleep: summarizeMetric(
            "sleep",
            sleep,
            targets.targetSleepHours,
            expectedDays,
            targets.targetSleepHours != null ? isSleepOnTarget : null,
            (average, target, loggedDays) => assessSleep(average, target, loggedDays)
        ),
    };
}

export function numericDelta(current: number | null, previous: number | null): number | null {
    if (current == null || previous == null) return null;
    return Math.round((current - previous) * 10) / 10;
}

/** Percentage change. Null when previous is missing or zero. */
export function percentDelta(current: number | null, previous: number | null): number | null {
    if (current == null || previous == null || previous === 0) return null;
    return Math.round(((current - previous) / previous) * 100);
}

export type WeightDirection = "GAINING" | "LOSING" | "MAINTAINING";

const WEIGHT_EQUAL_KG = 0.25;

export function resolveWeightDirection(
    targetKg: number | null | undefined,
    baselineKg: number | null | undefined
): WeightDirection | null {
    if (targetKg == null || baselineKg == null) return null;
    if (Math.abs(targetKg - baselineKg) < WEIGHT_EQUAL_KG) return "MAINTAINING";
    return targetKg > baselineKg ? "GAINING" : "LOSING";
}

export function interpretWeightChange(
    changeKg: number | null,
    direction: WeightDirection | null
): "toward" | "away" | "stable" | null {
    if (changeKg == null || direction == null) return null;
    if (Math.abs(changeKg) < 0.15) return "stable";
    if (direction === "MAINTAINING") return Math.abs(changeKg) < 0.8 ? "toward" : "away";
    if (direction === "GAINING") return changeKg > 0 ? "toward" : "away";
    return changeKg < 0 ? "toward" : "away";
}
