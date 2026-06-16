"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

const EXERCISES = [
    // Chest
    "Bench Press", "Barbell Bench Press", "Incline Bench Press", "Decline Bench Press", 
    "Dumbbell Bench Press", "Incline Dumbbell Bench Press", "Decline Dumbbell Bench Press",
    "Flat Dumbbell Fly", "Incline Dumbbell Press", "Cable Fly", "Pec Deck", "Push-Up", "Pushup",
    "Incline Push-Up", "Decline Push-Up", "Wall Pushup", "Wall Pushups", "Dips", "Chest Dips",
    // Back
    "Deadlift", "Barbell Deadlift", "Romanian Deadlift", "Dumbbell Romanian Deadlift", 
    "Sumo Deadlift", "Trap Bar Deadlift", "Barbell Row", "Barbell Rows", "Pull-Up", "Pull-Ups", 
    "Chin-Up", "Chin-Ups", "Lat Pulldown", "Lat Pulldowns", "Close-Grip Lat Pulldown", 
    "Seated Cable Row", "Seated Cable Rows", "T-Bar Row", "Single Arm Dumbbell Row", 
    "Face Pull", "Face Pulls", "Good Morning", "Hyperextension", "Back Extension", "Shrugs",
    // Shoulders
    "Overhead Press", "Military Press", "Dumbbell Shoulder Press", "Arnold Press", 
    "Lateral Raise", "Lateral Raises", "Cable Lateral Raise", "Front Raise", "Dumbbell Front Raise", 
    "Rear Delt Fly", "Dumbbell Rear Delt Fly", "Cable Rear Delt Fly", "Upright Row",
    // Biceps
    "Barbell Curl", "Barbell Curls", "Dumbbell Curl", "Dumbbell Curls", "Hammer Curl", "Hammer Curls",
    "Preacher Curl", "Incline Dumbbell Curl", "Cable Curl", "Concentration Curl", "EZ Bar Curl",
    // Triceps
    "Tricep Pushdown", "Tricep Pushdowns", "Tricep Rope Pushdown", "Skull Crushers", "Skull Crusher", 
    "Close Grip Bench Press", "Overhead Tricep Extension", "Tricep Dips", "Tricep Kickback", 
    "Cable Overhead Tricep Extension",
    // Legs
    "Squat", "Squats", "Back Squat", "Front Squat", "Goblet Squat", "Bulgarian Split Squat", 
    "Bulgarian Split Squats", "Leg Press", "Hack Squat", "Lunges", "Walking Lunges", "Reverse Lunges", 
    "Step Up", "Step Ups", "Romanian Deadlift", "Stiff Leg Deadlift", "Leg Curl", "Leg Curls", 
    "Leg Extension", "Leg Extensions", "Hip Thrust", "Hip Thrusts", "Glute Bridge", 
    "Calf Raise", "Calf Raises", "Standing Calf Raise", "Seated Calf Raise", "Seated Calf Raises",
    // Core
    "Plank", "Planks", "Side Plank", "Ab Wheel Rollout", "Cable Crunch", "Cable Crunches", 
    "Decline Crunch", "Hanging Leg Raise", "Hanging Leg Raises", "Hanging Knee Raise", 
    "Russian Twist", "Russian Twists", "Bicycle Crunch", "Crunch", "Crunches", "Sit-Up", 
    "Sit Up", "Sit-Ups", "Sit Ups",
    // Cardio / Compound
    "Treadmill", "Stairmaster", "Elliptical", "Stationary Bike", "Rowing Machine",
    "Running", "Cycling", "Swimming", "Jump Rope", "Farmers Walk", 
    "Trap Bar Deadlift", "Sumo Deadlift", "Power Clean", "Hang Clean", 
    "Snatch", "Box Jump", "Burpee", "Burpees", "Battle Ropes", "Sled Push", "Sled Pull",
    "Kettlebell Swing",
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

export function ExerciseAutocomplete({ value, onChange, placeholder, className, autoFocus }: Props) {
    const [open, setOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

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
        setActiveIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open || suggestions.length === 0) {
            if (e.key === "Enter" && value.trim()) {
                setOpen(false);
            }
            return;
        }

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % suggestions.length);
                break;
            case "ArrowUp":
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                break;
            case "Tab":
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % suggestions.length);
                break;
            case "Enter":
                if (activeIndex >= 0) {
                    e.preventDefault();
                    pick(suggestions[activeIndex]);
                } else if (suggestions.length > 0) {
                    // Optional: pick first suggestion on Enter even if not highlighted
                    // e.preventDefault();
                    // pick(suggestions[0]);
                    setOpen(false);
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
                placeholder={placeholder ?? "e.g. Incline Bench Press"}
                className={className}
                value={value}
                onChange={e => onChange(e.target.value)}
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
                            key={ex}
                            type="button"
                            onClick={() => pick(ex)}
                            onMouseEnter={() => setActiveIndex(i)}
                            className={cn(
                                "w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 border-b border-surface-border/50 last:border-0",
                                activeIndex === i 
                                    ? "bg-brand-500/20 text-brand-300" 
                                    : "text-fg hover:bg-brand-500/10 hover:text-brand-300"
                            )}
                        >
                            <span className={cn(
                                "w-4 h-4 rounded-md text-[9px] font-black flex items-center justify-center shrink-0 transition-colors",
                                activeIndex === i ? "bg-brand-400 text-white" : "bg-brand-400/10 text-brand-400"
                            )}>
                                {i + 1}
                            </span>
                            {ex}
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
