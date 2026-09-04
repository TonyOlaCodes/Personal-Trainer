/** Helpers that keep numeric `0` distinct from "no value". */

export function numberToInputValue(value: number | null | undefined): string {
    return value == null ? "" : String(value);
}

export function parseOptionalNumber(value: string | number | null | undefined): number | null {
    if (value === "" || value == null) return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
