import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { CoachProfilePeriodKey } from "@/lib/coachClientPeriodStats";
import { COACH_PROFILE_PERIODS } from "@/lib/coachClientPeriodStats";

export function missingLabel(value: number | string | null | undefined, suffix = ""): string {
    if (value == null || value === "") return "—";
    return `${value}${suffix}`;
}

export function formatKg(value: number | null | undefined, digits = 1): string {
    if (value == null) return "—";
    return `${value.toFixed(digits)} kg`;
}

export function formatSigned(value: number | null | undefined, suffix = "", digits = 1): string | null {
    if (value == null) return null;
    const rounded = Number(value.toFixed(digits));
    const sign = rounded > 0 ? "+" : "";
    return `${sign}${rounded}${suffix}`;
}

export function DeltaLine({
    value,
    percent,
    previousLabel,
    invertColor = false,
    neutral = false,
    suffix = "",
    digits = 1,
}: {
    value: number | null;
    percent?: number | null;
    previousLabel: string;
    invertColor?: boolean;
    neutral?: boolean;
    suffix?: string;
    digits?: number;
}) {
    const display = percent != null
        ? formatSigned(percent, "%", 0)
        : formatSigned(value, suffix, digits);
    if (!display) return null;
    const numeric = percent ?? value ?? 0;
    const positive = !neutral && (invertColor ? numeric < 0 : numeric > 0);
    const negative = !neutral && (invertColor ? numeric > 0 : numeric < 0);
    return (
        <p className={cn(
            "text-[10px] font-bold uppercase tracking-widest mt-1",
            positive ? "text-success" : negative ? "text-danger" : "text-fg-muted"
        )}>
            {numeric > 0 ? "↑" : numeric < 0 ? "↓" : "→"} {display} vs {previousLabel}
        </p>
    );
}

export function PeriodToggle({
    value,
    onChange,
}: {
    value: CoachProfilePeriodKey;
    onChange: (key: CoachProfilePeriodKey) => void;
}) {
    return (
        <div className="flex items-center gap-1 bg-surface-muted/50 p-1 rounded-xl border border-surface-border/60">
            {COACH_PROFILE_PERIODS.map((period) => (
                <button
                    key={period.key}
                    type="button"
                    onClick={() => onChange(period.key)}
                    className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                        value === period.key
                            ? "bg-brand-500 text-white shadow-sm"
                            : "text-fg-muted hover:text-fg"
                    )}
                >
                    {period.key === "7d" ? "7 days" : period.key === "30d" ? "Month" : "Year"}
                </button>
            ))}
        </div>
    );
}

export function SectionLabel({
    children,
    tone = "brand",
}: {
    children: ReactNode;
    tone?: "brand" | "warning" | "success" | "muted";
}) {
    const toneClass = {
        brand: "text-brand-400",
        warning: "text-warning",
        success: "text-success",
        muted: "text-fg-muted",
    }[tone];
    return (
        <h3 className={cn("text-[11px] font-black uppercase tracking-widest flex items-center gap-2", toneClass)}>
            {children}
        </h3>
    );
}
