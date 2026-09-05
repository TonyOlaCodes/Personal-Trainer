"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { WeightDirection } from "@/lib/lifestylePeriodMetrics";
import { formatKg } from "./profileUi";

interface WorkoutHistoryEntry {
    id: string;
    workoutId: string;
    workoutName: string;
    date: string;
    duration: number;
    volume: number;
}

export function ProgressTrendsCard({
    bodyweightHistory,
    workoutHistory,
    currentWeightKg,
    targetWeightKg,
    weightHidden,
    weightDirection,
    periodChangeKg,
    periodLabel,
}: {
    bodyweightHistory: { date: string; weightKg: number }[];
    workoutHistory: WorkoutHistoryEntry[];
    currentWeightKg: number | null;
    targetWeightKg: number | null;
    weightHidden: boolean;
    weightDirection: WeightDirection | null;
    periodChangeKg: number | null;
    periodLabel: string;
}) {
    const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; date: string; weightKg: number } | null>(null);
    const [hoveredVolPoint, setHoveredVolPoint] = useState<{
        id: string;
        workoutId: string;
        workoutName: string;
        date: string;
        formattedDate: string;
        volume: number;
        x: number;
        y: number;
    } | null>(null);
    const [selectedVolumeWorkoutId, setSelectedVolumeWorkoutId] = useState<string | null>(null);
    const [activeChartTab, setActiveChartTab] = useState<"weight" | "volume">(weightHidden ? "volume" : "weight");
    const [weightTimeframe, setWeightTimeframe] = useState<"week" | "month" | "year" | "all">("month");

    useEffect(() => {
        if (weightHidden && activeChartTab === "weight") setActiveChartTab("volume");
    }, [weightHidden, activeChartTab]);

    const filteredBodyweightHistory = useMemo(() => {
        if (weightTimeframe === "all") return bodyweightHistory;
        const now = new Date();
        const cutoff = new Date();
        if (weightTimeframe === "week") cutoff.setDate(now.getDate() - 7);
        else if (weightTimeframe === "month") cutoff.setDate(now.getDate() - 30);
        else cutoff.setDate(now.getDate() - 365);
        return bodyweightHistory.filter((row) => new Date(row.date) >= cutoff);
    }, [bodyweightHistory, weightTimeframe]);

    const chartValues = filteredBodyweightHistory.map((row) => row.weightKg);
    if (targetWeightKg != null) chartValues.push(targetWeightKg);
    const chartMin = chartValues.length > 0 ? Math.floor(Math.min(...chartValues) - 2) : 0;
    const chartMax = chartValues.length > 0 ? Math.ceil(Math.max(...chartValues) + 2) : 1;
    const chartRange = Math.max(chartMax - chartMin, 1);
    const chartWidth = 640;
    const chartHeight = 240;
    const chartPadding = { top: 20, right: 24, bottom: 34, left: 42 };
    const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
    const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
    const toX = (index: number) => chartPadding.left + (filteredBodyweightHistory.length === 1 ? plotWidth / 2 : (index / (filteredBodyweightHistory.length - 1)) * plotWidth);
    const toY = (weight: number) => chartPadding.top + ((chartMax - weight) / chartRange) * plotHeight;
    const chartPoints = filteredBodyweightHistory.map((row, index) => ({ ...row, x: toX(index), y: toY(row.weightKg) }));
    const linePath = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    const areaPath = chartPoints.length > 0
        ? `${linePath} L ${chartPoints[chartPoints.length - 1].x.toFixed(1)} ${(chartPadding.top + plotHeight).toFixed(1)} L ${chartPoints[0].x.toFixed(1)} ${(chartPadding.top + plotHeight).toFixed(1)} Z`
        : "";
    const targetY = targetWeightKg != null ? toY(targetWeightKg) : null;

    const volumeHistory = useMemo(
        () => [...workoutHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        [workoutHistory]
    );
    const volumeValues = volumeHistory.map((row) => row.volume);
    const volMin = volumeValues.length > 0 ? Math.max(0, Math.floor(Math.min(...volumeValues) - 200)) : 0;
    const volMax = volumeValues.length > 0 ? Math.ceil(Math.max(...volumeValues) + 200) : 1000;
    const volRange = Math.max(volMax - volMin, 1);
    const volChartWidth = 640;
    const volChartHeight = 240;
    const volChartPadding = { top: 20, right: 24, bottom: 34, left: 48 };
    const volPlotWidth = volChartWidth - volChartPadding.left - volChartPadding.right;
    const volPlotHeight = volChartHeight - volChartPadding.top - volChartPadding.bottom;
    const toVolX = (index: number) => volChartPadding.left + (volumeHistory.length === 1 ? volPlotWidth / 2 : (index / (volumeHistory.length - 1)) * volPlotWidth);
    const toVolY = (vol: number) => volChartPadding.top + ((volMax - vol) / volRange) * volPlotHeight;
    const volChartPoints = useMemo(
        () => volumeHistory.map((row, index) => ({
            ...row,
            formattedDate: new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            x: toVolX(index),
            y: toVolY(row.volume),
        })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [volumeHistory, volMin, volMax, volRange]
    );
    const selectedVolumePoints = useMemo(
        () => selectedVolumeWorkoutId ? volChartPoints.filter((point) => point.workoutId === selectedVolumeWorkoutId) : [],
        [volChartPoints, selectedVolumeWorkoutId]
    );
    const selectedVolumeName = selectedVolumePoints[0]?.workoutName
        ?? volumeHistory.find((row) => row.workoutId === selectedVolumeWorkoutId)?.workoutName
        ?? null;
    const volLinePath = volChartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    const volAreaPath = volChartPoints.length > 0
        ? `${volLinePath} L ${volChartPoints[volChartPoints.length - 1].x.toFixed(1)} ${(volChartPadding.top + volPlotHeight).toFixed(1)} L ${volChartPoints[0].x.toFixed(1)} ${(volChartPadding.top + volPlotHeight).toFixed(1)} Z`
        : "";
    const selectedVolLinePath = selectedVolumePoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    const selectedVolAreaPath = selectedVolumePoints.length > 0
        ? `${selectedVolLinePath} L ${selectedVolumePoints[selectedVolumePoints.length - 1].x.toFixed(1)} ${(volChartPadding.top + volPlotHeight).toFixed(1)} L ${selectedVolumePoints[0].x.toFixed(1)} ${(volChartPadding.top + volPlotHeight).toFixed(1)} Z`
        : "";
    const latestVolumeForDisplay = selectedVolumeWorkoutId
        ? (selectedVolumePoints[selectedVolumePoints.length - 1]?.volume ?? null)
        : volumeHistory.length > 0 ? volumeHistory[volumeHistory.length - 1].volume : null;

    useEffect(() => {
        if (selectedVolumeWorkoutId && !volumeHistory.some((row) => row.workoutId === selectedVolumeWorkoutId)) {
            setSelectedVolumeWorkoutId(null);
        }
    }, [volumeHistory, selectedVolumeWorkoutId]);

    const directionLabel = weightDirection === "GAINING"
        ? "Gaining"
        : weightDirection === "LOSING"
            ? "Losing"
            : weightDirection === "MAINTAINING"
                ? "Maintaining"
                : null;

    return (
        <section className="card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-surface-border/50">
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-4">
                        {!weightHidden && (
                            <button
                                type="button"
                                onClick={() => setActiveChartTab("weight")}
                                className={cn(
                                    "text-sm font-black uppercase tracking-wider pb-2 border-b-2 transition-all",
                                    activeChartTab === "weight" ? "border-brand-500 text-fg" : "border-transparent text-fg-muted hover:text-fg"
                                )}
                            >
                                Bodyweight
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setActiveChartTab("volume")}
                            className={cn(
                                "text-sm font-black uppercase tracking-wider pb-2 border-b-2 transition-all",
                                activeChartTab === "volume" ? "border-brand-500 text-fg" : "border-transparent text-fg-muted hover:text-fg"
                            )}
                        >
                            Training Volume
                        </button>
                    </div>
                    {activeChartTab === "weight" && (
                        <div className="flex items-center gap-1 bg-surface-muted/50 p-1 rounded-xl border border-surface-border/60">
                            {(["week", "month", "year", "all"] as const).map((tf) => (
                                <button
                                    key={tf}
                                    type="button"
                                    onClick={() => setWeightTimeframe(tf)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                        weightTimeframe === tf ? "bg-brand-500 text-white shadow-sm" : "text-fg-muted hover:text-fg"
                                    )}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {activeChartTab === "weight" ? (
                    <div className="text-right space-y-1">
                        <p className="text-xl font-black text-fg leading-none">{formatKg(currentWeightKg)}</p>
                        <p className="text-[10px] text-fg-subtle font-bold uppercase tracking-widest">
                            Target {targetWeightKg != null ? `${targetWeightKg.toFixed(1)} kg` : "—"}
                            {directionLabel ? ` · ${directionLabel}` : ""}
                        </p>
                        {periodChangeKg != null && (
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-muted">
                                {periodChangeKg > 0 ? "+" : ""}{periodChangeKg.toFixed(1)} kg · {periodLabel}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="text-right">
                        <p className="text-xl font-black text-fg leading-none font-mono">
                            {latestVolumeForDisplay != null ? `${latestVolumeForDisplay.toLocaleString()}kg` : "—"}
                        </p>
                        <p className="text-[10px] text-fg-subtle font-bold uppercase tracking-widest mt-1">
                            {selectedVolumeName ? `Latest ${selectedVolumeName}` : "Last workout volume"}
                        </p>
                    </div>
                )}
            </div>

            {activeChartTab === "volume" && selectedVolumeWorkoutId && selectedVolumeName && (
                <div className="flex items-center gap-2 mb-3 -mt-2">
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedVolumeWorkoutId(null);
                            setHoveredVolPoint(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-black uppercase tracking-widest text-indigo-300"
                    >
                        {selectedVolumeName}
                        <X className="w-3 h-3" />
                    </button>
                </div>
            )}

            {activeChartTab === "weight" ? (
                filteredBodyweightHistory.length > 0 ? (
                    <div className="h-64 relative">
                        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-full w-full" role="img" aria-label="Bodyweight trend">
                            <defs>
                                <linearGradient id="clientBodyweightFill" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="5%" stopColor="#38bdf8" stopOpacity="0.35" />
                                    <stop offset="95%" stopColor="#38bdf8" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            {[0, 1, 2, 3].map((line) => {
                                const y = chartPadding.top + (line / 3) * plotHeight;
                                const value = chartMax - (line / 3) * chartRange;
                                return (
                                    <g key={line}>
                                        <line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={y} y2={y} stroke="rgba(148,163,184,0.16)" strokeDasharray="4 4" />
                                        <text x={10} y={y + 4} fill="#94a3b8" fontSize="11" fontWeight="700">{value.toFixed(0)}</text>
                                    </g>
                                );
                            })}
                            {targetY !== null && (
                                <g>
                                    <line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={targetY} y2={targetY} stroke="#f87171" strokeDasharray="6 6" strokeWidth="2" />
                                    <text x={chartWidth - chartPadding.right - 54} y={Math.max(14, targetY - 7)} fill="#f87171" fontSize="11" fontWeight="800">Target</text>
                                </g>
                            )}
                            <path d={areaPath} fill="url(#clientBodyweightFill)" />
                            <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                            {chartPoints.map((point) => (
                                <g key={`${point.date}-${point.weightKg}`}>
                                    <circle cx={point.x} cy={point.y} r={hoveredPoint?.date === point.date ? 6 : 4} fill={hoveredPoint?.date === point.date ? "#38bdf8" : "#0f172a"} stroke="#38bdf8" strokeWidth="3" />
                                    <circle cx={point.x} cy={point.y} r="12" fill="transparent" className="cursor-pointer" onMouseEnter={() => setHoveredPoint(point)} onMouseLeave={() => setHoveredPoint(null)} />
                                </g>
                            ))}
                        </svg>
                        {hoveredPoint && (
                            <div className="absolute z-10 pointer-events-none bg-surface-elevated/95 border border-brand-500/30 px-3 py-1.5 rounded-xl -translate-x-1/2 -translate-y-full" style={{ left: `${(hoveredPoint.x / chartWidth) * 100}%`, top: `${(hoveredPoint.y / chartHeight) * 100 - 4}%` }}>
                                <p className="text-[9px] font-black text-brand-400 uppercase tracking-widest">{formatDate(hoveredPoint.date)}</p>
                                <p className="text-xs font-black text-fg">{hoveredPoint.weightKg.toFixed(1)} kg</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-48 rounded-2xl border border-dashed border-surface-border flex items-center justify-center text-sm text-fg-muted">
                        No bodyweight logs for this timeframe.
                    </div>
                )
            ) : volumeHistory.length > 0 ? (
                <div className="h-64 relative">
                    <svg viewBox={`0 0 ${volChartWidth} ${volChartHeight}`} className="h-full w-full touch-manipulation" role="img" aria-label="Training volume">
                        <defs>
                            <linearGradient id="clientVolumeFill" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="5%" stopColor="#818cf8" stopOpacity="0.35" />
                                <stop offset="95%" stopColor="#818cf8" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <g style={{ opacity: selectedVolumeWorkoutId ? 0.22 : 1 }} pointerEvents="none">
                            <path d={volAreaPath} fill="url(#clientVolumeFill)" />
                            <path d={volLinePath} fill="none" stroke="#818cf8" strokeWidth="3" />
                        </g>
                        {selectedVolumeWorkoutId && selectedVolumePoints.length > 1 && (
                            <path d={selectedVolAreaPath} fill="url(#clientVolumeFill)" />
                        )}
                        {selectedVolumeWorkoutId && selectedVolumePoints.length > 1 && (
                            <path d={selectedVolLinePath} fill="none" stroke="#a5b4fc" strokeWidth="3.5" />
                        )}
                        {volChartPoints.map((point) => {
                            const isSelectedType = selectedVolumeWorkoutId === point.workoutId;
                            const isFiltered = Boolean(selectedVolumeWorkoutId);
                            const isActive = !isFiltered || isSelectedType;
                            return (
                                <g key={point.id} style={{ opacity: isActive ? 1 : 0.28 }}>
                                    <circle
                                        cx={point.x}
                                        cy={point.y}
                                        r={isFiltered && isSelectedType ? 6 : 4}
                                        fill={isFiltered && isSelectedType ? "#a5b4fc" : "#0f172a"}
                                        stroke="#818cf8"
                                        strokeWidth="3"
                                    />
                                    <circle
                                        cx={point.x}
                                        cy={point.y}
                                        r="16"
                                        fill="transparent"
                                        className="cursor-pointer"
                                        onMouseEnter={() => {
                                            if (!selectedVolumeWorkoutId || selectedVolumeWorkoutId === point.workoutId) setHoveredVolPoint(point);
                                        }}
                                        onMouseLeave={() => setHoveredVolPoint(null)}
                                        onPointerUp={(e) => {
                                            if (e.pointerType === "mouse" && e.button !== 0) return;
                                            const next = selectedVolumeWorkoutId === point.workoutId ? null : point.workoutId;
                                            setSelectedVolumeWorkoutId(next);
                                            setHoveredVolPoint(next ? point : null);
                                        }}
                                    />
                                </g>
                            );
                        })}
                    </svg>
                    {hoveredVolPoint && (!selectedVolumeWorkoutId || hoveredVolPoint.workoutId === selectedVolumeWorkoutId) && (
                        <div className="absolute z-10 pointer-events-none bg-surface-elevated/95 border border-indigo-500/30 px-3 py-1.5 rounded-xl -translate-x-1/2 -translate-y-full" style={{ left: `${(hoveredVolPoint.x / volChartWidth) * 100}%`, top: `${(hoveredVolPoint.y / volChartHeight) * 100 - 4}%` }}>
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{hoveredVolPoint.workoutName}</p>
                            <p className="text-xs font-black text-fg">{hoveredVolPoint.volume.toLocaleString()} kg</p>
                        </div>
                    )}
                    {!selectedVolumeWorkoutId && (
                        <p className="text-[9px] text-fg-subtle font-bold uppercase tracking-widest mt-2 text-center">
                            Tap a workout point to see that session type
                        </p>
                    )}
                </div>
            ) : (
                <div className="h-48 rounded-2xl border border-dashed border-surface-border flex items-center justify-center text-sm text-fg-muted">
                    No workout logs recorded for this client.
                </div>
            )}
        </section>
    );
}
