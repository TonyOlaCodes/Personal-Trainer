"use client";

import { cn } from "@/lib/utils";
import type { ExerciseTrackingSchema, TrackingFieldKey } from "@/lib/exerciseTracking/types";
import { FIELD_LABELS } from "@/lib/exerciseTracking/types";
import { enabledInputFields, isFieldEnabled, usesStrengthOneRm } from "@/lib/exerciseTracking/schema";
import { formatPace } from "@/lib/exerciseTracking/format";
import { calculateOneRM } from "@/lib/oneRepMax";

export type SetMetricStrings = {
    weightKg: string;
    reps: number;
    rpe: string;
    durationSec: string;
    distanceMeters: string;
    heightCm: string;
    resistance: string;
    inclinePct: string;
    calories: string;
    heartRate: string;
    speedKph: string;
    rir: string;
};

const SHORT_LABEL: Partial<Record<TrackingFieldKey, string>> = {
    weight: "Weight",
    reps: "Reps",
    duration: "Time",
    distance: "Dist",
    height: "Ht",
    rpe: "RPE",
    rir: "RIR",
    speed: "Spd",
    resistance: "Lvl",
    incline: "Inc",
    calories: "Cal",
    heartRate: "HR",
    pace: "Pace",
};

function fieldSpan(fieldCount: number, key: TrackingFieldKey): string {
    // Rough responsive spans for common layouts
    if (key === "weight" || key === "duration" || key === "distance") return "col-span-3";
    if (key === "reps" || key === "rpe" || key === "height") return "col-span-2";
    return "col-span-2";
}

export function SetMetricHeaders({
    schema,
    sessionActive,
    showEst1Rm,
}: {
    schema: ExerciseTrackingSchema;
    sessionActive: boolean;
    showEst1Rm?: boolean;
}) {
    const fields = enabledInputFields(schema);
    const showPace = isFieldEnabled(schema, "pace");
    const show1rm = showEst1Rm !== false && usesStrengthOneRm(schema);

    return (
        <>
            {fields.map((key) => (
                <div key={key} className={cn("text-center", fieldSpan(fields.length, key))}>
                    {SHORT_LABEL[key] ?? FIELD_LABELS[key]}
                </div>
            ))}
            {showPace && <div className="col-span-2 text-center hidden md:block">Pace</div>}
            {show1rm && (
                <div
                    className={cn("text-center", sessionActive ? "hidden md:block md:col-span-2" : "col-span-2")}
                    title="Estimated 1RM"
                >
                    Est 1RM
                </div>
            )}
        </>
    );
}

export function SetMetricInputs({
    schema,
    set,
    sessionActive,
    placeholders,
    onChange,
    unitSuffix,
    disabled: disabledProp,
    inputAttr,
}: {
    schema: ExerciseTrackingSchema;
    set: SetMetricStrings;
    sessionActive: boolean;
    placeholders: Partial<Record<TrackingFieldKey, string>>;
    onChange: (patch: Partial<SetMetricStrings>) => void;
    unitSuffix?: { weight?: string; distance?: string; height?: string };
    /** Override — defaults to !sessionActive */
    disabled?: boolean;
    /** Extra attribute on each input (e.g. data-workout-set-input) */
    inputAttr?: string;
}) {
    const fields = enabledInputFields(schema);
    const disabled = disabledProp ?? !sessionActive;
    const extraAttr = inputAttr ? { [inputAttr]: "" } : {};

    const inputFor = (key: TrackingFieldKey) => {
        const common = "input input-sm text-center font-bold h-10 px-1";
        switch (key) {
            case "weight":
                return (
                    <div key={key} className={cn("relative", fieldSpan(fields.length, key))}>
                        <input
                            type="number"
                            inputMode="decimal"
                            className={common}
                            value={set.weightKg}
                            placeholder={placeholders.weight || ""}
                            disabled={disabled}
                            {...extraAttr}
                            onChange={(e) => onChange({ weightKg: e.target.value })}
                        />
                        {unitSuffix?.weight && (
                            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-fg-subtle pointer-events-none">
                                {unitSuffix.weight}
                            </span>
                        )}
                    </div>
                );
            case "reps":
                return (
                    <div key={key} className={fieldSpan(fields.length, key)}>
                        <input
                            type="number"
                            inputMode="numeric"
                            className={common}
                            value={set.reps > 0 ? set.reps : ""}
                            placeholder={placeholders.reps || ""}
                            disabled={disabled}
                            {...extraAttr}
                            onChange={(e) => onChange({ reps: parseInt(e.target.value, 10) || 0 })}
                        />
                    </div>
                );
            case "rpe":
                return (
                    <div key={key} className={fieldSpan(fields.length, key)}>
                        <input
                            type="number"
                            inputMode="numeric"
                            className={common}
                            value={set.rpe}
                            placeholder={placeholders.rpe || ""}
                            disabled={disabled}
                            {...extraAttr}
                            onChange={(e) => onChange({ rpe: e.target.value })}
                        />
                    </div>
                );
            case "duration":
                return (
                    <div key={key} className={cn("relative", fieldSpan(fields.length, key))}>
                        <input
                            type="number"
                            inputMode="decimal"
                            className={common}
                            value={set.durationSec}
                            placeholder={placeholders.duration || "sec"}
                            disabled={disabled}
                            {...extraAttr}
                            onChange={(e) => onChange({ durationSec: e.target.value })}
                        />
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-fg-subtle pointer-events-none">
                            s
                        </span>
                    </div>
                );
            case "distance":
                return (
                    <div key={key} className={cn("relative", fieldSpan(fields.length, key))}>
                        <input
                            type="number"
                            inputMode="decimal"
                            className={common}
                            value={set.distanceMeters}
                            placeholder={placeholders.distance || "m"}
                            disabled={disabled}
                            {...extraAttr}
                            onChange={(e) => onChange({ distanceMeters: e.target.value })}
                        />
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-fg-subtle pointer-events-none">
                            {unitSuffix?.distance ?? "m"}
                        </span>
                    </div>
                );
            case "height":
                return (
                    <div key={key} className={cn("relative", fieldSpan(fields.length, key))}>
                        <input
                            type="number"
                            inputMode="decimal"
                            className={common}
                            value={set.heightCm}
                            placeholder={placeholders.height || "cm"}
                            disabled={disabled}
                            {...extraAttr}
                            onChange={(e) => onChange({ heightCm: e.target.value })}
                        />
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-fg-subtle pointer-events-none">
                            {unitSuffix?.height ?? "cm"}
                        </span>
                    </div>
                );
            case "resistance":
                return (
                    <div key={key} className={fieldSpan(fields.length, key)}>
                        <input
                            type="number"
                            inputMode="decimal"
                            className={common}
                            value={set.resistance}
                            placeholder={placeholders.resistance || ""}
                            disabled={disabled}
                            {...extraAttr}
                            onChange={(e) => onChange({ resistance: e.target.value })}
                        />
                    </div>
                );
            case "incline":
                return (
                    <div key={key} className={fieldSpan(fields.length, key)}>
                        <input
                            type="number"
                            inputMode="decimal"
                            className={common}
                            value={set.inclinePct}
                            placeholder={placeholders.incline || "%"}
                            disabled={disabled}
                            {...extraAttr}
                            onChange={(e) => onChange({ inclinePct: e.target.value })}
                        />
                    </div>
                );
            case "speed":
                return (
                    <div key={key} className={fieldSpan(fields.length, key)}>
                        <input
                            type="number"
                            inputMode="decimal"
                            className={common}
                            value={set.speedKph}
                            placeholder={placeholders.speed || ""}
                            disabled={disabled}
                            {...extraAttr}
                            onChange={(e) => onChange({ speedKph: e.target.value })}
                        />
                    </div>
                );
            case "calories":
                return (
                    <div key={key} className={fieldSpan(fields.length, key)}>
                        <input
                            type="number"
                            inputMode="decimal"
                            className={common}
                            value={set.calories}
                            placeholder={placeholders.calories || ""}
                            disabled={disabled}
                            {...extraAttr}
                            onChange={(e) => onChange({ calories: e.target.value })}
                        />
                    </div>
                );
            case "heartRate":
                return (
                    <div key={key} className={fieldSpan(fields.length, key)}>
                        <input
                            type="number"
                            inputMode="numeric"
                            className={common}
                            value={set.heartRate}
                            placeholder={placeholders.heartRate || ""}
                            disabled={disabled}
                            {...extraAttr}
                            onChange={(e) => onChange({ heartRate: e.target.value })}
                        />
                    </div>
                );
            case "rir":
                return (
                    <div key={key} className={fieldSpan(fields.length, key)}>
                        <input
                            type="number"
                            inputMode="decimal"
                            className={common}
                            value={set.rir}
                            placeholder={placeholders.rir || ""}
                            disabled={disabled}
                            {...extraAttr}
                            onChange={(e) => onChange({ rir: e.target.value })}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    const dist = parseFloat(set.distanceMeters) || 0;
    const dur = parseFloat(set.durationSec) || 0;
    const pace =
        isFieldEnabled(schema, "pace") && dist > 0 && dur > 0
            ? formatPace(dist, dur, "METRIC")
            : null;

    const weightNum = parseFloat(set.weightKg) || 0;
    const est1RM =
        usesStrengthOneRm(schema) && weightNum > 0 && set.reps > 0
            ? calculateOneRM(weightNum, set.reps)
            : null;

    return (
        <>
            {fields.map((key) => inputFor(key))}
            {isFieldEnabled(schema, "pace") && (
                <div className="col-span-2 hidden md:flex items-center justify-center text-xs font-bold text-fg-muted">
                    {pace && pace !== "—" ? pace : "—"}
                </div>
            )}
            {usesStrengthOneRm(schema) && (
                <div
                    className={cn(
                        "text-center text-xs font-black text-fg-muted",
                        sessionActive ? "hidden md:block md:col-span-2" : "col-span-2"
                    )}
                >
                    {est1RM != null ? Math.round(est1RM) : "—"}
                </div>
            )}
        </>
    );
}

export function emptySetMetrics(): SetMetricStrings {
    return {
        weightKg: "",
        reps: 0,
        rpe: "",
        durationSec: "",
        distanceMeters: "",
        heightCm: "",
        resistance: "",
        inclinePct: "",
        calories: "",
        heartRate: "",
        speedKph: "",
        rir: "",
    };
}
