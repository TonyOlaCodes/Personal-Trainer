"use client";

import { useState, useRef, useEffect } from "react";

const EXERCISES = [
    // Chest
    "Bench Press", "Incline Bench Press", "Decline Bench Press", "Flat Dumbbell Fly",
    "Incline Dumbbell Press", "Cable Fly", "Pec Deck", "Push-Up", "Dips",
    // Back
    "Deadlift", "Barbell Row", "Pull-Up", "Chin-Up", "Lat Pulldown",
    "Seated Cable Row", "T-Bar Row", "Single Arm Dumbbell Row", "Face Pull",
    "Good Morning", "Hyperextension",
    // Shoulders
    "Overhead Press", "Dumbbell Shoulder Press", "Arnold Press", "Lateral Raise",
    "Front Raise", "Rear Delt Fly", "Upright Row", "Shrugs",
    // Biceps
    "Barbell Curl", "Dumbbell Curl", "Hammer Curl", "Preacher Curl",
    "Incline Dumbbell Curl", "Cable Curl", "Concentration Curl",
    // Triceps
    "Tricep Pushdown", "Skull Crushers", "Close Grip Bench Press",
    "Overhead Tricep Extension", "Tricep Kickback", "Cable Overhead Tricep Extension",
    // Legs
    "Squat", "Back Squat", "Front Squat", "Goblet Squat", "Bulgarian Split Squat",
    "Leg Press", "Hack Squat", "Lunges", "Walking Lunges", "Step Ups",
    "Romanian Deadlift", "Stiff Leg Deadlift", "Leg Curl", "Leg Extension",
    "Hip Thrust", "Glute Bridge", "Calf Raise", "Seated Calf Raise",
    // Core
    "Plank", "Ab Wheel Rollout", "Cable Crunch", "Hanging Leg Raise",
    "Russian Twist", "Bicycle Crunch", "Crunch", "Sit Up", "Side Plank",
    // Cardio / Compound
    "Treadmill", "Stairmaster", "Elliptical", "Stationary Bike", "Rowing Machine",
    "Running", "Cycling", "Swimming", "Jump Rope", "Farmers Walk", 
    "Trap Bar Deadlift", "Sumo Deadlift", "Power Clean", "Hang Clean", 
    "Snatch", "Box Jump", "Burpee", "Battle Ropes", "Sled Push", "Sled Pull",
];

const CARDIO_MATCHERS = [
    "treadmill", "stairmaster", "elliptical", "bike", "rowing", 
    "run", "cycling", "swim", "jump rope", "cardio", "sprint"
];

export function isCardio(name: string): boolean {
    const n = name.toLowerCase();
    return CARDIO_MATCHERS.some(m => n.includes(m));
}

interface Props {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    className?: string;
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
    // Contains all words out of order (e.g. "press bench" -> "bench press")
    if (qWords.length > 1 && qWords.every(w => t.includes(w))) return 3;

    // Word-by-word typo allowance (e.g. "bnch pres" -> "bench press")
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

    // Accept if total typos are small relative to word count
    if (totalDistance <= Math.max(1, qWords.length * 2)) {
        return 4 + totalDistance;
    }

    return 999; // no match
}

export function ExerciseAutocomplete({ value, onChange, placeholder, className }: Props) {
    const [open, setOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const q = value.trim();
        if (q.length < 1) {
            setSuggestions([]);
            setOpen(false);
            return;
        }

        const matches = EXERCISES
            .map(ex => ({ name: ex, score: scoreMatch(q, ex) }))
            .filter(item => item.score < 999)
            .sort((a, b) => a.score - b.score || a.name.length - b.name.length)
            .map(item => item.name)
            .slice(0, 3);

        setSuggestions(matches);
        
        // Only auto-open if the value is being typed (not just loaded)
        // and if it's NOT an exact match yet (or we want to show alternatives)
        // But the key is to ONLY open if we have focus.
        if (document.activeElement === inputRef.current && matches.length > 0) {
            setOpen(true);
        }
    }, [value]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const pick = (ex: string) => {
        onChange(ex);
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative">
            <input
                ref={inputRef}
                type="text"
                placeholder={placeholder ?? "e.g. Incline Bench Press"}
                className={className}
                value={value}
                onChange={e => onChange(e.target.value)}
                onFocus={() => {
                    if (suggestions.length > 0) setOpen(true);
                }}
                autoComplete="off"
            />
            {open && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface-elevated border border-surface-border rounded-xl shadow-card overflow-hidden">
                    {suggestions.map((ex, i) => (
                        <button
                            key={ex}
                            type="button"
                            onMouseDown={() => pick(ex)}
                            className="w-full text-left px-4 py-2.5 text-sm text-fg hover:bg-brand-400/10 hover:text-brand-300 transition-colors flex items-center gap-2 border-b border-surface-border/50 last:border-0"
                        >
                            <span className="w-4 h-4 rounded-md bg-brand-400/10 text-brand-400 text-[9px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                            {ex}
                        </button>
                    ))}
                    <div className="px-4 py-1.5 text-[10px] text-fg-subtle border-t border-surface-border/30 bg-surface-muted/30">
                        Or keep typing to use your own name
                    </div>
                </div>
            )}
        </div>
    );
}
