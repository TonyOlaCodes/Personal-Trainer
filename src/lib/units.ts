export type UnitSystem = "METRIC" | "IMPERIAL";

export const LBS_PER_KG = 2.2046226218;
export const CM_PER_INCH = 2.54;
export const INCHES_PER_FOOT = 12;

export function kgToLbsNumber(kg: number): number {
    return kg * LBS_PER_KG;
}

export function lbsToKg(lbs: number): number {
    return lbs / LBS_PER_KG;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
    const totalInches = cm / CM_PER_INCH;
    const feet = Math.floor(totalInches / INCHES_PER_FOOT);
    const inches = Math.round(totalInches - feet * INCHES_PER_FOOT);
    if (inches === INCHES_PER_FOOT) {
        return { feet: feet + 1, inches: 0 };
    }
    return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
    const totalInches = feet * INCHES_PER_FOOT + inches;
    return totalInches * CM_PER_INCH;
}

export function parseOptionalFloat(value: string | undefined): number | null {
    if (!value || value.trim() === "") return null;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function metricBodyFromForm(input: {
    unitSystem: UnitSystem;
    heightCm?: string;
    heightFt?: string;
    heightIn?: string;
    weightKg?: string;
    weightLbs?: string;
    targetWeightKg?: string;
    targetWeightLbs?: string;
}) {
    if (input.unitSystem === "IMPERIAL") {
        const feet = parseOptionalFloat(input.heightFt) ?? 0;
        const inches = parseOptionalFloat(input.heightIn) ?? 0;
        const hasHeight = Boolean(input.heightFt?.trim() || input.heightIn?.trim());

        return {
            heightCm: hasHeight ? feetInchesToCm(feet, inches) : null,
            weightKg: input.weightLbs?.trim() ? lbsToKg(parseFloat(input.weightLbs)) : null,
            targetWeightKg: input.targetWeightLbs?.trim() ? lbsToKg(parseFloat(input.targetWeightLbs)) : null,
        };
    }

    return {
        heightCm: parseOptionalFloat(input.heightCm),
        weightKg: parseOptionalFloat(input.weightKg),
        targetWeightKg: parseOptionalFloat(input.targetWeightKg),
    };
}

export function formatWeightFromKg(kg: number | null | undefined, unitSystem: UnitSystem): string {
    if (kg == null || !Number.isFinite(kg)) return "--";
    if (unitSystem === "IMPERIAL") {
        return `${kgToLbsNumber(kg).toFixed(1)} lbs`;
    }
    return `${kg.toFixed(1)} kg`;
}

let unitSystemColumnReady = false;

export async function ensureUnitSystemColumn(db: { $executeRawUnsafe: (query: string) => Promise<unknown> }) {
    if (unitSystemColumnReady) return;
    await db.$executeRawUnsafe(`
        DO $$ BEGIN
            CREATE TYPE "UnitSystem" AS ENUM ('METRIC', 'IMPERIAL');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `);
    await db.$executeRawUnsafe(`
        ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "unitSystem" "UnitSystem" NOT NULL DEFAULT 'METRIC'
    `);
    unitSystemColumnReady = true;
}

export function formatHeightFromCm(cm: number | null | undefined, unitSystem: UnitSystem): string {
    if (cm == null || !Number.isFinite(cm)) return "--";
    if (unitSystem === "IMPERIAL") {
        const { feet, inches } = cmToFeetInches(cm);
        return `${feet}' ${inches}"`;
    }
    return `${Math.round(cm)} cm`;
}
