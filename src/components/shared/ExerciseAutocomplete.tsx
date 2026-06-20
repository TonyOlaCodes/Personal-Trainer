"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { muscleGroupBadgeClass } from "@/lib/muscleGroups";

type ExerciseOption = { name: string; muscleGroup?: string | null };

/** Full-name cardio exercises (single word) — avoids false positives like "Crunch" matching "run". */
const EXACT_CARDIO_NAMES = new Set([
    "walk", "walking", "jog", "jogging", "run", "running", "sprint", "sprints",
    "swim", "swimming", "cycling", "skipping", "rower", "cardio",
]);

/** Multi-word or distinctive cardio phrases — safe to match with includes(). */
const CARDIO_PHRASE_MATCHERS = [
    "treadmill", "stairmaster", "stair climber", "stepmill", "elliptical",
    "stationary bike", "spin bike", "assault bike", "air bike", "rowing machine",
    "jump rope", "double unders", "ski erg", "versaclimber", "battle rope",
    "sled push", "sled pull", "sled drag", "prowler push", "prowler pull",
    "treadmill walk", "incline treadmill walk", "treadmill run",
    "hill sprint", "interval run", "tempo run", "long run",
    "outdoor cycling", "jumping jack", "jumping jacks", "high knees", "butt kicks",
    "shadow boxing", "box step-over", "shuttle run", "agility ladder",
    "bear crawl", "crab walk", "cross trainer", "burpee", "burpees",
];

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesCardioPhrase(name: string, phrase: string): boolean {
    const normalizedName = name.toLowerCase().trim();
    const normalizedPhrase = phrase.toLowerCase().trim();
    if (!normalizedPhrase) return false;

    if (normalizedPhrase.includes(" ")) {
        return normalizedName.includes(normalizedPhrase);
    }

    return new RegExp(`\\b${escapeRegExp(normalizedPhrase)}\\b`, "i").test(normalizedName);
}

export function isCardio(name: string, muscleGroup?: string | null): boolean {
    const group = muscleGroup?.toLowerCase();
    if (group === "cardio") return true;
    if (group) return false;

    const normalizedName = name.toLowerCase().trim();
    if (!normalizedName) return false;
    if (EXACT_CARDIO_NAMES.has(normalizedName)) return true;

    return CARDIO_PHRASE_MATCHERS.some((phrase) => matchesCardioPhrase(normalizedName, phrase));
}

interface Props {
    value: string;
    onChange: (val: string, muscleGroup?: string | null) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
}

function getDistance(a: string, b: string): number {
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = i;
        for (let j = 1; j <= b.length; j++) {
            const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
            row[j - 1] = prev;
            prev = val;
        }
        row[b.length] = prev;
    }
    return row[b.length];
}

function scoreMatch(query: string, target: string): number {
    const q = query.toLowerCase().trim();
    const t = target.toLowerCase();

    if (t === q) return 0;
    if (t.startsWith(q)) return 1;
    if (t.includes(q)) return 2;

    const qWords = q.split(/\s+/);
    if (qWords.length > 1 && qWords.every((w) => t.includes(w))) return 3;

    const tWords = t.split(/\s+/);
    let totalDistance = 0;
    for (const qw of qWords) {
        let best = Infinity;
        for (const tw of tWords) {
            const dist = getDistance(qw, tw);
            if (dist < best) best = dist;
        }
        totalDistance += best;
    }

    if (totalDistance <= Math.max(1, qWords.length * 2)) {
        return 4 + totalDistance;
    }

    return 999;
}

let globalExercisesCache: ExerciseOption[] | null = null;
let globalExercisesPromise: Promise<ExerciseOption[]> | null = null;

async function fetchGlobalExercises(): Promise<ExerciseOption[]> {
    if (globalExercisesCache) return globalExercisesCache;
    if (globalExercisesPromise) return globalExercisesPromise;

    globalExercisesPromise = fetch("/api/exercises")
        .then((res) => {
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        })
        .then((data: ExerciseOption[]) => {
            globalExercisesCache = data;
            return data;
        })
        .catch((err) => {
            console.error("Failed to load exercises from API", err);
            return [];
        });

    return globalExercisesPromise;
}

export function ExerciseAutocomplete({ value, onChange, placeholder, className, autoFocus }: Props) {
    const [open, setOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<ExerciseOption[]>([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [dbExercises, setDbExercises] = useState<ExerciseOption[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchGlobalExercises().then((list) => {
            if (list.length > 0) setDbExercises(list);
        });
    }, []);

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    useEffect(() => {
        const q = value.trim();
        if (q.length < 1) {
            setSuggestions([]);
            setOpen(false);
            setActiveIndex(-1);
            return;
        }

        const matches = dbExercises
            .map((ex) => ({ ...ex, score: scoreMatch(q, ex.name) }))
            .filter((item) => item.score < 999)
            .sort((a, b) => a.score - b.score || a.name.length - b.name.length)
            .slice(0, 6);

        setSuggestions(matches);

        if (document.activeElement === inputRef.current && matches.length > 0) {
            setOpen(true);
        }
    }, [value, dbExercises]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const pick = (ex: ExerciseOption) => {
        onChange(ex.name, ex.muscleGroup);
        setOpen(false);
        setActiveIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open || suggestions.length === 0) {
            if (e.key === "Enter" && value.trim()) setOpen(false);
            return;
        }

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setActiveIndex((prev) => (prev + 1) % suggestions.length);
                break;
            case "ArrowUp":
                e.preventDefault();
                setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                break;
            case "Tab":
                e.preventDefault();
                setActiveIndex((prev) => (prev + 1) % suggestions.length);
                break;
            case "Enter":
                if (activeIndex >= 0) {
                    e.preventDefault();
                    pick(suggestions[activeIndex]);
                } else {
                    setOpen(false);
                }
                break;
            case "Escape":
                setOpen(false);
                break;
        }
    };

    return (
        <div ref={containerRef} className="relative">
            <input
                ref={inputRef}
                type="text"
                placeholder={placeholder ?? "e.g. Lat Pullover"}
                className={className}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => {
                    if (suggestions.length > 0) setOpen(true);
                }}
                onKeyDown={handleKeyDown}
                autoComplete="off"
            />
            {open && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface-elevated border border-surface-border rounded-xl shadow-lg overflow-hidden animate-slide-up">
                    {suggestions.map((ex, i) => (
                        <button
                            key={ex.name}
                            type="button"
                            onClick={() => pick(ex)}
                            onMouseEnter={() => setActiveIndex(i)}
                            className={cn(
                                "w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-3 border-b border-surface-border/50 last:border-0",
                                activeIndex === i
                                    ? "bg-brand-500/20 text-brand-300"
                                    : "text-fg hover:bg-brand-500/10 hover:text-brand-300"
                            )}
                        >
                            <span className="flex items-center gap-2 min-w-0">
                                <span className={cn(
                                    "w-4 h-4 rounded-md text-[9px] font-black flex items-center justify-center shrink-0 transition-colors",
                                    activeIndex === i ? "bg-brand-400 text-white" : "bg-brand-400/10 text-brand-400"
                                )}>
                                    {i + 1}
                                </span>
                                <span className="truncate">{ex.name}</span>
                            </span>
                            {ex.muscleGroup && (
                                <span className={cn(
                                    "text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider shrink-0",
                                    muscleGroupBadgeClass(ex.muscleGroup)
                                )}>
                                    {ex.muscleGroup}
                                </span>
                            )}
                        </button>
                    ))}
                    <div className="px-4 py-1.5 text-[10px] text-fg-subtle border-t border-surface-border/30 bg-surface-muted/30 flex justify-between font-bold uppercase tracking-wider">
                        <span>↑↓ to navigate • Ent to pick</span>
                    </div>
                </div>
            )}
        </div>
    );
}
