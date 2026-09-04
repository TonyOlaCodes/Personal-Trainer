/**
 * Canonical Exercise Dictionary tracking assignment.
 * Identity keys keep aliases together, but Hold names are matched on the
 * display name so "Superman Holds" does not pull "Superman" onto Timed.
 */

import { exerciseIdentityKey } from "@/lib/exerciseIdentity";
import type { DictionaryTrackingPreset } from "./types";

const HOLD_NAME = /\bholds?\b/i;
const DEAD_HANG = /\bdead hang\b/i;

function key(name: string): string {
    return exerciseIdentityKey(name);
}

function listedMatch(name: string, listed: string[]): boolean {
    const nameKey = key(name);
    if (!nameKey) return false;
    const nameHasHold = HOLD_NAME.test(name);

    for (const entry of listed) {
        const entryKey = key(entry);
        if (!entryKey) continue;
        if (HOLD_NAME.test(entry) && !nameHasHold) continue;
        if (nameKey === entryKey) return true;
        if (entryKey.includes(" ") && (nameKey === entryKey || nameKey.endsWith(` ${entryKey}`) || nameKey.includes(` ${entryKey} `))) {
            return true;
        }
    }
    return false;
}

const HEIGHT_NAMES = [
    "Box Jump",
    "Box Jump Over",
    "Broad Jump",
    "Depth Jump",
];

const LOAD_DISTANCE_NAMES = [
    "Bottoms Up Kettlebell Carry",
    "Dumbbell Farmer's Carry",
    "Farmer's Carry",
    "Kettlebell Farmer's Carry",
    "Plate Pinch Carry",
    "Single Arm Plate Pinch Carry",
    "Suitcase Carry",
    "Trap Bar Carry",
    "Sandbag Carry",
    "Yoke Walk",
    "Prowler Pull",
    "Prowler Push",
    "Sled Drag",
    "Sled Pull",
    "Sled Push",
];

const DISTANCE_NAMES = [
    "Agility Ladder",
    "Air Bike",
    "Assault Bike",
    "Bear Crawl",
    "Butt Kicks",
    "Crab Walk",
    "Cross Trainer",
    "Cycling",
    "Elliptical",
    "High Knees",
    "Hill Sprint",
    "Incline Treadmill Walk",
    "Interval Run",
    "Jog",
    "Jogging",
    "Long Run",
    "Outdoor Cycling",
    "Rower",
    "Rowing Machine",
    "Run",
    "Running",
    "Shuttle Run",
    "Ski Erg",
    "Spin Bike",
    "Sprint",
    "Stair Climber",
    "Stairmaster",
    "Stationary Bike",
    "Stepmill",
    "Swim",
    "Swimming",
    "Tempo Run",
    "Treadmill",
    "Treadmill Run",
    "Treadmill Walk",
    "VersaClimber",
    "Walk",
    "Walking",
    "Rope Climb",
    "Legless Rope Climb",
];

const TIMED_NAMES = [
    "Handstand Hold",
    "Barbell Hold",
    "Dead Hang",
    "Double Overhand Barbell Hold",
    "Dumbbell Hold",
    "Fat Grip Dead Hang",
    "Fat Grip Hold",
    "Gripper Hold",
    "Plate Pinch Hold",
    "Rack Barbell Hold",
    "Single Arm Dead Hang",
    "Single Arm Plate Pinch Hold",
    "Trap Bar Hold",
    "Weighted Dead Hang",
    "Wall Sit",
    "Copenhagen Plank",
    "Hollow Body Hold",
    "L-Sit",
    "Plank",
    "RKC Plank",
    "Side Plank",
    "Hanging Leg Raise Hold",
    "L-Sit Hold",
    "Parallel Bar Support Hold",
    "Pistol Squat Hold",
    "Planche Hold",
    "Ring Support Hold",
    "Superman Holds",
    "Back Lever",
    "Crow Pose",
    "Frog Stand",
    "Front Lever",
    "Human Flag",
    "Battle Ropes",
    "Battle Rope",
    "Shadow Boxing",
];

const STRENGTH_CARDIO_NAMES = [
    "Burpee",
    "Box Step-Over",
    "Double Unders",
    "Jump Rope",
    "Jumping Jack",
    "Mountain Climber",
    "Skipping",
];

export function classifyDictionaryTrackingPreset(
    name: string,
    _muscleGroup?: string | null
): DictionaryTrackingPreset {
    if (listedMatch(name, HEIGHT_NAMES)) return "height_reps";
    if (listedMatch(name, LOAD_DISTANCE_NAMES)) return "weight_distance";
    if (listedMatch(name, STRENGTH_CARDIO_NAMES)) return "strength";
    if (listedMatch(name, DISTANCE_NAMES)) return "distance_time";
    if (listedMatch(name, TIMED_NAMES)) return "timed";
    if (HOLD_NAME.test(name) || DEAD_HANG.test(name)) return "timed";
    return "strength";
}
